<?php

namespace App\Policies;

use App\Enums\UserRole;
use App\Models\Tender;
use App\Models\User;

/**
 * Accès aux demandes : le porteur propriétaire, ou un fournisseur destinataire (SCRUM-43 / SCRUM-44).
 */
class TenderPolicy
{
    public function view(User $user, Tender $tender): bool
    {
        if ($user->role === UserRole::Buyer) {
            return $user->buyerProfile?->id === $tender->buyer_id;
        }

        if ($user->role === UserRole::Supplier && $user->supplierProfile) {
            return $tender->recipients()
                ->where('supplier_id', $user->supplierProfile->id)
                ->exists();
        }

        return false;
    }

    public function cancel(User $user, Tender $tender): bool
    {
        return $user->role === UserRole::Buyer && $user->buyerProfile?->id === $tender->buyer_id;
    }

    public function invite(User $user, Tender $tender): bool
    {
        return $this->cancel($user, $tender);
    }
}
