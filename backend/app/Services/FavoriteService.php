<?php

namespace App\Services;

use App\Enums\UserRole;
use App\Models\BuyerProfile;
use App\Models\SupplierProfile;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Fournisseurs favoris d'un porteur de projet (SCRUM-39).
 * Ajout et retrait idempotents ; seuls les fournisseurs encore visibles sont listés.
 */
class FavoriteService
{
    /**
     * @return Collection<int, SupplierProfile>
     */
    public function list(BuyerProfile $buyer): Collection
    {
        return $buyer->favoriteSuppliers()
            ->visibleInCatalog()
            ->with(['region:id,name', 'categories:id,name,parent_id'])
            ->orderByPivot('created_at', 'desc')
            ->orderByPivot('supplier_id', 'desc')
            ->get();
    }

    public function add(BuyerProfile $buyer, SupplierProfile $supplier): void
    {
        $buyer->favoriteSuppliers()->syncWithoutDetaching([$supplier->id]);
    }

    public function remove(BuyerProfile $buyer, SupplierProfile $supplier): void
    {
        $buyer->favoriteSuppliers()->detach($supplier->id);
    }

    /**
     * Le fournisseur est-il dans les favoris de l'utilisateur ? false pour un invité, un fournisseur ou un admin.
     */
    public function isFavorite(?User $user, SupplierProfile $supplier): bool
    {
        $buyerId = $this->buyerIdOf($user);

        return $buyerId !== null && DB::table('favorites')
            ->where('buyer_id', $buyerId)
            ->where('supplier_id', $supplier->id)
            ->exists();
    }

    private function buyerIdOf(?User $user): ?int
    {
        if ($user === null || $user->role !== UserRole::Buyer) {
            return null;
        }

        return $user->buyerProfile?->id;
    }
}
