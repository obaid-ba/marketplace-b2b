<?php

namespace App\Http\Controllers\Api\Buyer;

use App\Http\Controllers\Controller;
use App\Models\AiInteraction;
use App\Models\Tender;
use App\Services\Ai\SimulatedAiClient;
use App\Services\QuoteSummaryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Résumé automatique des devis (SCRUM-119 / F25).
 */
class QuoteSummaryController extends Controller
{
    public function __construct(private readonly QuoteSummaryService $service) {}

    public function show(Tender $tender): JsonResponse
    {
        Gate::authorize('view', $tender);

        return $this->respond($tender, $this->service->latest($tender));
    }

    public function store(Request $request, Tender $tender): JsonResponse
    {
        Gate::authorize('view', $tender);

        return $this->respond($tender, $this->service->summarize($request->user(), $tender, $request->boolean('force')));
    }

    /**
     * Version de l'acheteur et utilité : la sortie d'origine est conservée.
     */
    public function update(Request $request, Tender $tender): JsonResponse
    {
        Gate::authorize('view', $tender);

        $validated = $request->validate([
            'summary' => ['sometimes', 'required', 'string', 'max:1500'],
            'accepted' => ['sometimes', 'required', 'boolean'],
        ], [
            'summary.required' => 'Le résumé ne peut pas être vide.',
            'summary.max' => 'Le résumé ne doit pas dépasser 1500 caractères.',
        ]);

        $interaction = $this->service->latest($tender) ?? abort(404, 'Aucun résumé pour cette demande.');

        if (array_key_exists('summary', $validated)) {
            $text = trim($validated['summary']);
            // Revenir au texte d'origine annule la modification.
            $interaction->edited_output = $text === $interaction->output['summary'] ? null : ['summary' => $text];
        }

        if (array_key_exists('accepted', $validated)) {
            $interaction->accepted = $validated['accepted'];
        }

        $interaction->save();

        return $this->respond($tender, $interaction);
    }

    private function respond(Tender $tender, ?AiInteraction $interaction): JsonResponse
    {
        return response()->json([
            'can_generate' => $this->service->canGenerate($tender),
            'summary' => $interaction ? [
                'id' => $interaction->id,
                'text' => $interaction->edited_output['summary'] ?? $interaction->output['summary'],
                'original_text' => $interaction->output['summary'],
                'edited' => $interaction->edited_output !== null,
                'accepted' => $interaction->accepted,
                'quotes' => $interaction->output['quotes'],
                'simulated' => $interaction->provider === SimulatedAiClient::NAME,
                // Une demande close n'est plus comparée : son dernier résumé n'est pas « périmé ».
                'stale' => $tender->isOpen() && $this->service->isStale($tender, $interaction),
                'created_at' => $interaction->created_at?->toIso8601String(),
            ] : null,
        ]);
    }
}
