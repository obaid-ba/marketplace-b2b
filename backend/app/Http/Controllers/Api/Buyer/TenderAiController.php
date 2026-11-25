<?php

namespace App\Http\Controllers\Api\Buyer;

use App\Http\Controllers\Controller;
use App\Models\Tender;
use App\Services\Ai\SimulatedAiClient;
use App\Services\MarketPriceService;
use App\Services\TenderAnalysisService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * IA sur les demandes du porteur de projet (SCRUM-125 / F31).
 * - SCRUM-81 : catégorie, mots-clés et fournisseurs suggérés pendant la saisie de « Publier une demande ».
 * - SCRUM-82 : prix habituel du marché sur « Comparer les devis ».
 */
class TenderAiController extends Controller
{
    public function analyze(Request $request, TenderAnalysisService $analysis): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'min:3', 'max:150'],
            'description' => ['required', 'string', 'min:20', 'max:5000'],
            // Catégorie déjà choisie par le porteur : elle prime pour les suggestions.
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'region_id' => ['nullable', 'integer', 'exists:regions,id'],
        ], [
            'title.required' => 'Saisissez d’abord le titre de la demande.',
            'description.required' => 'Décrivez d’abord votre besoin.',
            'description.min' => 'Décrivez votre besoin en au moins 20 caractères pour lancer l’analyse.',
        ]);

        $result = $analysis->analyze($request->user(), $validated['title'], $validated['description']);
        $detectedId = $result['category']?->id;
        $categoryId = isset($validated['category_id']) ? (int) $validated['category_id'] : $detectedId;
        $regionId = isset($validated['region_id']) ? (int) $validated['region_id'] : null;

        $suggestions = $analysis->suggestSuppliers(
            $categoryId,
            $regionId,
            $validated['title'],
            $validated['description'],
            $result['keywords'],
            $detectedId,
        );

        $simulated = $result['interaction']->provider === SimulatedAiClient::NAME;

        return response()->json([
            'interaction_id' => $result['interaction']->id,
            'category' => $result['category'] ? [
                'id' => $result['category']->id,
                'name' => $result['category']->name,
                'parent_id' => $result['category']->parent_id,
            ] : null,
            'keywords' => $result['keywords'],
            'confidence' => $result['confidence'],
            'suggested_suppliers' => $suggestions->map(fn (array $item) => [
                'id' => $item['supplier']->id,
                'company_name' => $item['supplier']->company_name,
                'region' => $item['supplier']->region?->name,
                'rating_avg' => round((float) $item['supplier']->rating_avg, 1),
                'reviews_count' => (int) $item['supplier']->reviews_count,
                'score' => $item['score'],
                'reasons' => $item['reasons'],
            ])->values(),
            'simulated' => $simulated,
            'label' => ($simulated ? 'Mode simulé, sans IA' : 'Proposé par IA').' — à vérifier : vous restez libre de vos choix.',
        ]);
    }

    public function marketPrice(Request $request, Tender $tender, MarketPriceService $prices): JsonResponse
    {
        Gate::authorize('view', $tender);

        return response()->json($prices->estimate($request->user(), $tender->loadMissing('category:id,name')));
    }
}
