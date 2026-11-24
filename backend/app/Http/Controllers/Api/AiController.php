<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AiInteraction;
use App\Models\Quote;
use App\Models\Tender;
use App\Services\Ai\AiAssistant;
use App\Services\Ai\AiUnavailableException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Assistants de rédaction et d'aide à la décision (SCRUM-124, SCRUM-77,
 * SCRUM-78, SCRUM-79 / F30).
 *
 * Le texte proposé est toujours renvoyé comme une suggestion modifiable
 * (`editable: true`). Chaque appel est journalisé dans `ai_interactions`.
 */
class AiController extends Controller
{
    public function __construct(private readonly AiAssistant $assistant) {}

    public function tenderDraft(Request $request): JsonResponse
    {
        if (! $request->user()->buyerProfile) {
            return response()->json(['message' => 'Seul un porteur de projet peut générer un brouillon de demande.'], 403);
        }

        $validated = $request->validate([
            'prompt' => ['required', 'string', 'min:5', 'max:5000'],
            'category' => ['nullable', 'string', 'max:100'],
            'region' => ['nullable', 'string', 'max:100'],
        ]);

        return $this->generate($request, 'tender_draft', $validated['prompt'], [
            'category' => $validated['category'] ?? null,
            'region' => $validated['region'] ?? null,
            'label' => 'Brouillon de demande',
        ], 'Brouillon généré par IA — à relire et modifier avant publication.');
    }

    public function productText(Request $request): JsonResponse
    {
        if (! $request->user()->supplierProfile) {
            return response()->json(['message' => 'Seul un fournisseur peut générer un texte produit.'], 403);
        }

        $validated = $request->validate([
            'text' => ['required', 'string', 'min:3', 'max:5000'],
            'action' => ['nullable', 'string', 'in:draft,rephrase'],
            'category' => ['nullable', 'string', 'max:100'],
        ]);

        $action = $validated['action'] ?? 'draft';
        $input = $action === 'rephrase'
            ? 'Reformule ce texte produit : '.$validated['text']
            : $validated['text'];

        return $this->generate($request, 'product_text', $input, [
            'category' => $validated['category'] ?? null,
            'label' => $action === 'rephrase' ? 'Reformulation de texte produit' : 'Texte produit',
        ], 'Texte généré par IA — à relire et modifier avant publication.', $validated['text']);
    }

    public function quoteSummary(Request $request): JsonResponse
    {
        $buyer = $request->user()->buyerProfile;

        if (! $buyer) {
            return response()->json(['message' => 'Seul un porteur de projet peut comparer des devis.'], 403);
        }

        $validated = $request->validate([
            'tender_id' => ['required', 'integer', 'exists:tenders,id'],
        ]);

        $tender = Tender::query()
            ->where('buyer_id', $buyer->id)
            ->findOrFail($validated['tender_id']);

        $quotes = Quote::query()
            ->where('tender_id', $tender->id)
            ->with('supplier:id,company_name,rating_avg')
            ->get()
            ->map(fn (Quote $quote) => [
                'supplier' => $quote->supplier?->company_name,
                'amount' => number_format((float) $quote->amount, 2, '.', ''),
                'delivery_days' => $quote->delivery_days,
                'rating_avg' => $quote->supplier?->rating_avg !== null
                    ? (float) $quote->supplier->rating_avg
                    : null,
            ])
            ->all();

        return $this->generate($request, 'quote_summary', 'Comparaison des devis reçus', [
            'quotes' => $quotes,
            'label' => "Comparaison des devis — demande #{$tender->id}",
        ], 'Aide à la décision générée par IA');
    }

    public function accept(Request $request, AiInteraction $interaction): JsonResponse
    {
        if ($interaction->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Interaction introuvable.'], 404);
        }

        $interaction->update(['accepted' => true]);

        return response()->json([
            'message' => 'La suggestion a été marquée comme acceptée.',
            'interaction' => $interaction,
        ]);
    }

    /**
     * @param  array<string, mixed>  $context
     */
    private function generate(
        Request $request,
        string $feature,
        string $input,
        array $context,
        string $label,
        ?string $before = null,
    ): JsonResponse {
        try {
            $interaction = $this->assistant->run($request->user(), $feature, $input, $context);
        } catch (AiUnavailableException $exception) {
            return response()->json(['message' => $exception->getMessage()], 503);
        }

        return response()->json([
            'interaction_id' => $interaction->id,
            'feature' => $feature,
            'output' => $interaction->output,
            'editable' => true,
            'label' => $label,
            'before' => $before,
            'after' => $interaction->output,
        ]);
    }
}
