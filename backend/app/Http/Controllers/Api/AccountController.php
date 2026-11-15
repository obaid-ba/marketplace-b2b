<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
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
 * Paramètres du compte (SCRUM-27).
 * Un utilisateur connecté met à jour ses informations, son mot de passe et son adresse e-mail.
 * Ces routes restent accessibles tant que l'e-mail n'est pas vérifié : c'est justement
 * après un changement d'adresse que le compte repasse par la vérification.
 */
class AccountController extends Controller
{
    public function show(Request $request): UserResource
    {
        return new UserResource($this->loadProfiles($request->user()));
    }

    public function updateProfile(UpdateProfileRequest $request): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validated();

        DB::transaction(function () use ($user, $validated) {
            $firstName = $validated['first_name'];
            $lastName = $validated['last_name'];

            $user->forceFill([
                'first_name' => $firstName,
                'last_name' => $lastName,
                'name' => trim("{$firstName} {$lastName}"),
                'phone' => $validated['phone'],
            ])->save();

            // Le porteur de projet complète aussi son organisation et son secteur.
            if ($user->role === UserRole::Buyer) {
                $user->buyerProfile()->updateOrCreate([], [
                    'organization' => $validated['organization'],
                    'sector' => $validated['sector'],
                ]);
            }
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
        $currentToken = $user->currentAccessToken();
        if ($currentToken instanceof PersonalAccessToken) {
            $user->tokens()->where('id', '!=', $currentToken->getKey())->delete();
        }

        return response()->json([
            'message' => 'Votre mot de passe a été modifié. Les autres sessions ont été déconnectées.',
        ]);
    }

    public function updateEmail(UpdateEmailRequest $request): JsonResponse
    {
        $user = $request->user();
        $email = $request->string('email')->toString();

        $attributes = [
            'email' => $email,
            'email_verified_at' => null,
        ];

        // Ne réactive pas un compte suspendu ou désactivé par un simple changement d'adresse.
        if (! $user->isBlocked()) {
            $attributes['status'] = UserStatus::EMAIL_TO_VERIFY;
        }

        $user->forceFill($attributes)->save();

        try {
            // Le lien part vers la nouvelle adresse ; l'ancienne n'est plus utilisée pour se connecter.
            $user->sendEmailVerificationNotification();
        } catch (Throwable $exception) {
            // L'adresse est déjà enregistrée : une erreur d'envoi ne doit pas annuler la modification.
            Log::error("Échec de l'envoi de l'e-mail de vérification après changement d'adresse.", [
                'user_id' => $user->id,
                'exception' => $exception,
            ]);
        }

        return response()->json([
            'message' => "Un lien de vérification a été envoyé à {$email}.",
            'user' => new UserResource($this->loadProfiles($user->refresh())),
        ]);
    }

    /**
     * Le profil dépend du rôle : le porteur de projet a un BuyerProfile, le fournisseur un SupplierProfile.
     */
    private function loadProfiles(User $user): User
    {
        return $user->load(['supplierProfile', 'buyerProfile']);
    }
}
