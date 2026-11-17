<?php

namespace App\Policies;

use App\Models\Product;
use App\Models\User;

/**
 * Produits d'un fournisseur (SCRUM-33 / SCRUM-34) : seul le propriétaire les consulte en privé,
 * les modifie, les dépublie ou les supprime.
 */
class ProductPolicy
{
    public function view(User $user, Product $product): bool
    {
        return $this->owns($user, $product);
    }

    public function update(User $user, Product $product): bool
    {
        return $this->owns($user, $product);
    }

    public function delete(User $user, Product $product): bool
    {
        return $this->owns($user, $product);
    }

    private function owns(User $user, Product $product): bool
    {
        $supplierId = $user->supplierProfile?->id;

        return $supplierId !== null && $supplierId === $product->supplier_id;
    }
}
