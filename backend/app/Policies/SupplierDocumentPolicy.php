<?php

namespace App\Policies;

use App\Models\SupplierDocument;
use App\Models\User;

/**
 * Justificatifs d'un fournisseur : fichiers privés, téléchargeables par leur propriétaire.
 * (L'accès administrateur sera ajouté avec la validation des fournisseurs, SCRUM-31.)
 */
class SupplierDocumentPolicy
{
    public function view(User $user, SupplierDocument $document): bool
    {
        return $document->supplierProfile?->user_id === $user->id;
    }
}
