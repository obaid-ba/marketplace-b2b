<?php

namespace App\Policies;

use App\Models\SupplierProfile;
use App\Models\User;

/**
 * Profil de l'entreprise (SCRUM-28) : seul le propriétaire le consulte en privé et le modifie.
 */
class SupplierProfilePolicy
{
    public function view(User $user, SupplierProfile $profile): bool
    {
        return $user->id === $profile->user_id;
    }

    public function update(User $user, SupplierProfile $profile): bool
    {
        return $user->id === $profile->user_id;
    }
}
