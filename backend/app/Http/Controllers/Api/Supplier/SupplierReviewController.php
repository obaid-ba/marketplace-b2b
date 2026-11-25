<?php

namespace App\Http\Controllers\Api\Supplier;

use App\Http\Controllers\Controller;
use App\Models\Review;
use App\Notifications\ReviewReplyNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Gestion des avis reçus côté fournisseur (SCRUM-65 / F20).
 */
class SupplierReviewController extends Controller
{
    /**
     * Liste paginée des avis reçus par le fournisseur + statistiques.
     */
    public function index(Request $request): JsonResponse
    {
        $supplierProfile = $request->user()->supplierProfile;
        if (! $supplierProfile) {
            return response()->json(['message' => 'Profil fournisseur introuvable.'], 403);
        }

        // Statistiques globales
        $stats = Review::query()
            ->where('supplier_id', $supplierProfile->id)
            ->published()
            ->selectRaw('AVG(rating) as avg_rating, COUNT(*) as total_count')
            ->first();

        // Répartition par étoiles
        $distribution = Review::query()
            ->where('supplier_id', $supplierProfile->id)
            ->published()
            ->selectRaw('rating, COUNT(*) as count')
            ->groupBy('rating')
            ->orderBy('rating', 'desc')
            ->pluck('count', 'rating');

        $starDistribution = [];
        for ($i = 5; $i >= 1; $i--) {
            $starDistribution[$i] = $distribution[$i] ?? 0;
        }

        // Liste paginée des avis
        $perPage = max(1, min(50, (int) $request->query('per_page', 10)));
        $reviews = Review::query()
            ->where('supplier_id', $supplierProfile->id)
            ->published()
            ->with([
                'buyer.user:id,name',
                'buyer:id,user_id,organization',
                'order:id,created_at,total',
                // Mon signalement éventuel (SCRUM-66).
                'reports' => fn ($query) => $query->where('author_id', $request->user()->id)->select(['id', 'review_id', 'reason', 'status']),
            ])
            ->orderByDesc('created_at')
            ->paginate($perPage);

        return response()->json([
            'rating_avg' => $stats->avg_rating ? round((float) $stats->avg_rating, 2) : 0,
            'reviews_count' => (int) ($stats->total_count ?? 0),
            'star_distribution' => $starDistribution,
            // Emplacement du résumé IA des avis (SCRUM-65), pas encore généré.
            'ai_summary' => null,
            'reviews' => $reviews,
        ]);
    }

    /**
     * Répondre à un avis (une seule réponse autorisée).
     */
    public function reply(Request $request, Review $review): JsonResponse
    {
        $supplierProfile = $request->user()->supplierProfile;
        if (! $supplierProfile || $review->supplier_id !== $supplierProfile->id) {
            return response()->json(['message' => 'Action non autorisée sur cet avis.'], 403);
        }

        if ($review->supplier_reply !== null) {
            return response()->json([
                'message' => 'Vous avez déjà répondu à cet avis.',
            ], 422);
        }

        $validated = $request->validate([
            'reply' => ['required', 'string', 'min:2', 'max:2000'],
        ]);

        $review->update(['supplier_reply' => $validated['reply']]);

        // Notifier l'acheteur de la réponse du fournisseur
        $review->loadMissing(['buyer.user', 'supplier']);
        $buyerUser = $review->buyer?->user;
        if ($buyerUser) {
            $buyerUser->notify(new ReviewReplyNotification($review));
        }

        $review->load([
            'buyer.user:id,name',
            'buyer:id,user_id,organization',
            'order:id,created_at,total',
        ]);

        return response()->json([
            'message' => 'Votre réponse a été enregistrée.',
            'review' => $review,
        ]);
    }
}
