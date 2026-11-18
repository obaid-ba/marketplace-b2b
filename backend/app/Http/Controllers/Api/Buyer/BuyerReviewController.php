<?php

namespace App\Http\Controllers\Api\Buyer;

use App\Enums\OrderStatus;
use App\Enums\ReviewStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Review;
use App\Models\User;
use App\Notifications\ReviewSubmittedNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Dépôt d'un avis par l'acheteur sur une commande clôturée (SCRUM-64 / F20).
 */
class BuyerReviewController extends Controller
{
    /**
     * Laisser un avis sur une commande clôturée.
     */
    public function store(Request $request, Order $order): JsonResponse
    {
        $buyerProfile = $request->user()->buyerProfile;
        if (! $buyerProfile || $order->buyer_id !== $buyerProfile->id) {
            return response()->json(['message' => 'Action non autorisée sur cette commande.'], 403);
        }

        if ($order->status !== OrderStatus::CLOSED) {
            return response()->json([
                'message' => 'Vous ne pouvez laisser un avis qu\'après avoir confirmé la réception et clôturé la commande.',
            ], 422);
        }

        if ($order->review()->exists()) {
            return response()->json([
                'message' => 'Un avis a déjà été déposé pour cette commande.',
            ], 422);
        }

        $validated = $request->validate([
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'comment' => ['nullable', 'string', 'max:2000'],
        ]);

        $review = DB::transaction(function () use ($order, $validated) {
            $review = Review::create([
                'order_id' => $order->id,
                'buyer_id' => $order->buyer_id,
                'supplier_id' => $order->supplier_id,
                'rating' => $validated['rating'],
                'comment' => $validated['comment'] ?? null,
                'status' => ReviewStatus::PUBLISHED,
            ]);

            // Recalcul immédiat de la note moyenne du fournisseur
            $stats = Review::query()
                ->where('supplier_id', $order->supplier_id)
                ->where('status', ReviewStatus::PUBLISHED->value)
                ->selectRaw('AVG(rating) as avg_rating, COUNT(*) as total_count')
                ->first();

            $order->supplier()->update([
                'rating_avg' => round($stats->avg_rating, 2),
                'reviews_count' => $stats->total_count,
            ]);

            return $review;
        });

        $review->load(['buyer.user:id,name', 'buyer:id,user_id,organization', 'order:id,created_at,total']);

        // Notifications
        $supplierUser = $order->supplier?->user;
        if ($supplierUser) {
            $review->loadMissing(['buyer.user', 'supplier']);
            $supplierUser->notify(new ReviewSubmittedNotification($review));
        }

        // Alerte admin si avis critique (≤ 2 étoiles)
        if ($review->rating <= 2) {
            $admins = User::where('role', UserRole::Admin)->get();
            foreach ($admins as $admin) {
                $admin->notify(new ReviewSubmittedNotification($review));
            }
        }

        $supplierProfile = $order->supplier()->first();

        return response()->json([
            'message' => 'Votre avis a été enregistré avec succès.',
            'review' => $review,
            'rating_avg' => $supplierProfile ? (float) $supplierProfile->rating_avg : null,
        ], 201);
    }
}
