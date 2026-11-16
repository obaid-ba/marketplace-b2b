<?php

namespace App\Services;

use App\Models\Product;
use App\Models\ProductView;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * Enregistre une consultation de fiche produit (SCRUM-36), après l'envoi de la réponse.
 *
 * - une seule vue par visiteur et par produit par tranche de 30 minutes (dédoublonnage par le cache,
 *   sans migration : un visiteur = son compte, ou à défaut son adresse IP + navigateur hachés) ;
 * - aucune vue pour le fournisseur propriétaire du produit.
 */
class ProductViewRecorder
{
    public const WINDOW_MINUTES = 30;

    public function record(Product $product, Request $request): void
    {
        /** @var User|null $user */
        $user = $request->user('sanctum');

        if ($user !== null && $user->supplierProfile?->id === $product->supplier_id) {
            return;
        }

        $visitor = $user !== null
            ? "user:{$user->id}"
            : 'guest:'.hash('sha256', $request->ip().'|'.$request->userAgent());

        $productId = $product->id;
        $userId = $user?->id;

        dispatch(function () use ($productId, $userId, $visitor) {
            $key = "product-view:{$productId}:{$visitor}";

            // add() n'écrit que si la clé n'existe pas : une seule vue par tranche de 30 minutes.
            if (Cache::add($key, true, now()->addMinutes(self::WINDOW_MINUTES))) {
                ProductView::query()->create([
                    'product_id' => $productId,
                    'user_id' => $userId,
                    'viewed_at' => now(),
                ]);
            }
        })->afterResponse();
    }
}
