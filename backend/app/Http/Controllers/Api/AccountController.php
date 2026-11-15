<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Account\ConfirmAccountPasswordRequest;
use App\Http\Requests\Account\UpdateAccountRequest;
use App\Http\Requests\Account\UpdateEmailRequest;
use App\Http\Requests\Account\UpdatePasswordRequest;
use App\Http\Requests\Account\UpdateProfileRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Laravel\Sanctum\PersonalAccessToken;
use Throwable;

/**
 * Paramètres du compte (SCRUM-27 / SCRUM-98).
 *
 * Un utilisateur connecté met à jour ses informations, son mot de passe et son
 * adresse e-mail, puis peut désactiver ou supprimer son compte.
 * Ces routes restent accessibles tant que l'e-mail n'est pas vérifié : c'est justement
 * après un changement d'adresse que le compte repasse par la vérification.
 */
class AccountController extends Controller
{
    public function show(Request $request): UserResource
    {
        return new UserResource($this->loadProfiles($request->user()));
    }

    /**
     * Mise à jour complète du compte (SCRUM-98) : nom, téléphone, profil et e-mail.
     * Si l'adresse change, la vérification est réinitialisée et un nouveau lien part
     * vers la nouvelle adresse.
     */
    public function updateAccount(UpdateAccountRequest $request): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validated();
        $emailChanged = strtolower($validated['email']) !== strtolower((string) $user->email);

        DB::transaction(function () use ($user, $validated, $emailChanged) {
            $this->fillProfile($user, $validated);

            if ($emailChanged) {
                $this->fillEmail($user, $validated['email']);
            }

            $user->save();
        });

        if ($emailChanged) {
            $this->sendVerificationEmail($user);
        }

        return response()->json([
            'message' => $emailChanged
                ? "Vos informations ont été mises à jour. Un lien de vérification a été envoyé à {$validated['email']}."
                : 'Vos informations ont été mises à jour.',
            'user' => new UserResource($this->loadProfiles($user->refresh())),
        ]);
    }

    public function updateProfile(UpdateProfileRequest $request): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validated();

        DB::transaction(function () use ($user, $validated) {
            $this->fillProfile($user, $validated);
            $user->save();
        });

        return response()->json([
            'message' => 'Vos informations ont été mises à jour.',
            'user' => new UserResource($this->loadProfiles($user->refresh())),
        ]);
    }

    public function updatePassword(UpdatePasswordRequest $request): JsonResponse
    {
        $user = $request->user();

        $user->forceFill([
            'password' => $request->string('password')->toString(),
        ])->save();

        // Les autres jetons (autres navigateurs, mobile) ne doivent plus donner accès au compte.
        $this->revokeOtherTokens($user);

        return response()->json([
            'message' => 'Votre mot de passe a été modifié. Les autres sessions ont été déconnectées.',
        ]);
    }

    public function updateEmail(UpdateEmailRequest $request): JsonResponse
    {
        $user = $request->user();
        $email = $request->string('email')->toString();

        $this->fillEmail($user, $email);
        $user->save();

        $this->sendVerificationEmail($user);

        return response()->json([
            'message' => "Un lien de vérification a été envoyé à {$email}.",
            'user' => new UserResource($this->loadProfiles($user->refresh())),
        ]);
    }

    /**
     * Désactivation du compte (SCRUM-30 / SCRUM-98) : le compte ne peut plus se connecter,
     * disparaît du catalogue et tous les jetons sont révoqués.
     */
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

    /**
     * Suppression douce du compte (SCRUM-30 / SCRUM-98) : la ligne `users` est marquée
     * `deleted_at`, mais les profils, commandes, factures et avis restent en base pour
     * l'historique comptable.
     */
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
     * Champs communs et profil du porteur de projet.
     *
     * @param  array<string, mixed>  $validated
     */
    private function fillProfile(User $user, array $validated): void
    {
        $firstName = $validated['first_name'];
        $lastName = $validated['last_name'];

        $user->forceFill([
            'first_name' => $firstName,
            'last_name' => $lastName,
            'name' => trim("{$firstName} {$lastName}"),
            'phone' => $validated['phone'],
        ]);

        // Le porteur de projet complète aussi son organisation et son secteur.
        if ($user->role === UserRole::Buyer) {
            $user->buyerProfile()->updateOrCreate([], [
                'organization' => $validated['organization'],
                'sector' => $validated['sector'],
            ]);
        }
    }

    /**
     * Prépare le changement d'adresse : vérification à refaire, sans réactiver un compte bloqué.
     */
    private function fillEmail(User $user, string $email): void
    {
        $user->forceFill([
            'email' => $email,
            'email_verified_at' => null,
            'status' => $user->isBlocked() ? $user->status : UserStatus::EMAIL_TO_VERIFY,
        ]);
    }

    /**
     * Le lien part vers la nouvelle adresse ; une erreur d'envoi ne doit pas annuler
     * la modification (l'adresse est déjà enregistrée).
     */
    private function sendVerificationEmail(User $user): void
    {
        try {
            $user->sendEmailVerificationNotification();
        } catch (Throwable $exception) {
            Log::error("Échec de l'envoi de l'e-mail de vérification après changement d'adresse.", [
                'user_id' => $user->id,
                'exception' => $exception,
            ]);
        }
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

    /**
     * Changement de mot de passe : on garde la session courante, on ferme les autres.
     */
    private function revokeOtherTokens(User $user): void
    {
        $currentToken = $user->currentAccessToken();

        if ($currentToken instanceof PersonalAccessToken) {
            $user->tokens()->where('id', '!=', $currentToken->getKey())->delete();
        }
    }

    /**
     * Le profil dépend du rôle : le porteur de projet a un BuyerProfile, le fournisseur un SupplierProfile.
     */
    private function loadProfiles(User $user): User
    {
        return $user->load(['supplierProfile', 'buyerProfile']);
    }
}
