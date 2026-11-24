<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AiInteraction;
use App\Services\Ai\SimulatedAiClient;
use App\Services\WritingAssistant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Assistants de rédaction (SCRUM-124, SCRUM-77, SCRUM-78 / F30).
 * Le résumé des devis est sur la page de comparaison (QuoteSummaryController).
 *
 * Le texte proposé est toujours renvoyé comme une suggestion modifiable
 * (`editable: true`). Chaque appel est journalisé dans `ai_interactions`.
 */
class AiController extends Controller
{
    public function __construct(private readonly WritingAssistant $assistant) {}

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

        return $this->respond($this->assistant->tenderDraft(
            $request->user(),
            $validated['prompt'],
            $validated['category'] ?? null,
            $validated['region'] ?? null,
        ));
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

        return $this->respond($this->assistant->productText(
            $request->user(),
            $validated['text'],
            ($validated['action'] ?? 'draft') === 'rephrase',
            $validated['category'] ?? null,
        ), $validated['text']);
    }

    public function accept(Request $request, AiInteraction $interaction): JsonResponse
    {
        if ($interaction->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Interaction introuvable.'], 404);
        }

        $interaction->update(['accepted' => true]);

        return response()->json([
            'message' => 'La suggestion a été marquée comme acceptée.',
            'interaction' => $interaction->only(['id', 'accepted']),
        ]);
    }

    private function respond(AiInteraction $interaction, ?string $before = null): JsonResponse
    {
        $text = $interaction->output['text'];
        $simulated = $interaction->provider === SimulatedAiClient::NAME;

        return response()->json([
            'interaction_id' => $interaction->id,
            'feature' => $interaction->context,
            'output' => $text,
            'editable' => true,
            'simulated' => $simulated,
            'label' => ($simulated ? 'Mode simulé, sans IA' : 'Texte généré par IA').' — à relire et modifier avant publication.',
            'before' => $before,
            'after' => $text,
        ]);
    }
}
