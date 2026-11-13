<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Account\ConfirmAccountPasswordRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * Désactivation et suppression du compte (SCRUM-30).
 *
 * Les deux actions exigent le mot de passe de l'utilisateur, révoquent tous ses
 * jetons Sanctum (déconnexion immédiate de tous les appareils) et masquent le
 * profil fournisseur du catalogue.
 *
 * La suppression est douce : la ligne `users` est marquée `deleted_at`, mais les
 * profils, commandes, factures et avis restent en base pour l'historique comptable.
 */
class AccountController extends Controller
{
    public function deactivate(ConfirmAccountPasswordRequest $request): JsonResponse
    {
        $user = $request->user();

        $user->forceFill(['status' => UserStatus::DEACTIVATED])->save();

        $this->hideFromCatalog($user);
        $this->revokeTokens($user);

        return response()->json([
            'message' => 'Votre compte a été désactivé. Vous êtes déconnecté de tous vos appareils.',
        ]);
    }

    public function destroy(ConfirmAccountPasswordRequest $request): JsonResponse
    {
        $user = $request->user();

        DB::transaction(function () use ($user) {
            $this->hideFromCatalog($user);
            $this->revokeTokens($user);
            $user->delete(); // Suppression douce : profils, commandes, factures et avis conservés.
        });

        return response()->json([
            'message' => 'Votre compte a été supprimé. Vos commandes, factures et avis sont conservés.',
        ]);
    }

    /**
     * Un fournisseur désactivé ou supprimé ne doit plus apparaître dans le
     * catalogue ni dans les recherches, même si son profil avait été validé.
     */
    private function hideFromCatalog(User $user): void
    {
        if ($user->role === UserRole::Supplier) {
            $user->supplierProfile()->update(['is_published' => false]);
        }
    }

    /**
     * Déconnexion immédiate : le jeton courant et ceux des autres appareils
     * (web, mobile) ne donnent plus accès au compte.
     */
    private function revokeTokens(User $user): void
    {
        $user->tokens()->delete();
    }
}
