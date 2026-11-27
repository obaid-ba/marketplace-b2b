<?php

namespace App\Policies;

use App\Enums\UserRole;
use App\Models\Quote;
use App\Models\User;

/**
 * Droits sur un devis : le fournisseur auteur, ou le porteur propriétaire de la demande.
 */
class QuotePolicy
{
    public function accept(User $user, Quote $quote): bool
    {
        if ($user->role !== UserRole::Buyer || ! $user->buyerProfile) {
            return false;
        }

        return $quote->tender()->where('buyer_id', $user->buyerProfile->id)->exists();
    }

    public function update(User $user, Quote $quote): bool
    {
        return $user->role === UserRole::Supplier
            && $user->supplierProfile?->id === $quote->supplier_id
            && $quote->isEditable();
    }
}
