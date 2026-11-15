<?php

namespace App\Policies;

use App\Enums\UserRole;
use App\Models\SupplierDocument;
use App\Models\User;

/**
 * Justificatifs d'un fournisseur : fichiers privés, téléchargeables par leur propriétaire
 * ou par un administrateur dans le cadre de la validation (SCRUM-31).
 */
class SupplierDocumentPolicy
{
    public function view(User $user, SupplierDocument $document): bool
    {
        return $user->hasRole(UserRole::Admin)
            || $document->supplierProfile?->user_id === $user->id;
    }
}
