<?php

namespace App\Services;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use App\Notifications\AccountReactivatedNotification;
use App\Notifications\AccountSuspendedNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Gestion des comptes par l'administrateur (SCRUM-118 / F24).
 */
class UserAdministrationService
{
    public function __construct(private readonly AuditLogger $audit) {}

    /**
     * Suspension : connexion refusée, toutes les sessions fermées, fournisseur retiré du catalogue
     * (SupplierProfile::scopeVisibleInCatalog). Le profil reste publié : il réapparaît à la réactivation.
     */
    public function suspend(User $user, User $admin, string $reason): User
    {
        DB::transaction(function () use ($user, $admin, $reason) {
            $locked = $this->lockManageable($user, $admin);

            if ($locked->status === UserStatus::SUSPENDED) {
                $this->refuse('Ce compte est déjà suspendu.');
            }

            $locked->forceFill(['status' => UserStatus::SUSPENDED])->save();
            $locked->tokens()->delete();
            $this->audit->log($admin, 'user.suspended', "user:{$locked->id}", $reason);
        });

        $user->refresh()->notify(new AccountSuspendedNotification($reason));

        return $user;
    }

    /**
     * Réactivation d'un compte suspendu par un admin ou désactivé par son titulaire.
     * Un compte dont l'e-mail n'a jamais été vérifié repasse par la vérification.
     */
    public function reactivate(User $user, User $admin, string $reason): User
    {
        DB::transaction(function () use ($user, $admin, $reason) {
            $locked = $this->lockManageable($user, $admin);

            if (! $locked->isBlocked()) {
                $this->refuse("Ce compte n'est ni suspendu ni désactivé.");
            }

            $locked->forceFill([
                'status' => $locked->hasVerifiedEmail() ? UserStatus::ACTIVE : UserStatus::EMAIL_TO_VERIFY,
            ])->save();
            $this->audit->log($admin, 'user.reactivated', "user:{$locked->id}", $reason);
        });

        $user->refresh()->notify(new AccountReactivatedNotification);

        return $user;
    }

    /**
     * Raison pour laquelle l'admin ne peut pas agir sur ce compte, ou null s'il le peut.
     */
    public function refusalFor(User $user, User $admin): ?string
    {
        return match (true) {
            $user->is($admin) => 'Vous ne pouvez pas modifier votre propre compte ici.',
            // Un admin ne peut pas en bloquer un autre : la plateforme garde toujours un administrateur.
            $user->hasRole(UserRole::Admin) => 'Un compte administrateur ne se gère pas depuis cette page.',
            $user->trashed() => 'Ce compte a été supprimé par son titulaire.',
            default => null,
        };
    }

    private function lockManageable(User $user, User $admin): User
    {
        $locked = User::withTrashed()->lockForUpdate()->findOrFail($user->id);

        if ($refusal = $this->refusalFor($locked, $admin)) {
            $this->refuse($refusal);
        }

        return $locked;
    }

    private function refuse(string $message): never
    {
        throw ValidationException::withMessages(['user' => $message]);
    }
}
