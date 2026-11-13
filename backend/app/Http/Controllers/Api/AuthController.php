<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * Connexion, utilisateur connecté et déconnexion (SCRUM-25).
 * Un compte dont l'e-mail reste à vérifier peut se connecter (pour redemander le lien),
 * mais n'accède pas aux espaces métier (middleware "verified", SCRUM-24).
 */
class AuthController extends Controller
{
    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::where('email', strtolower($request->input('email')))->first();

        // Même message que l'e-mail existe ou non : on ne révèle pas quels comptes existent.
        if (! $user || ! Hash::check($request->input('password'), $user->password)) {
            throw ValidationException::withMessages([
                'email' => 'Adresse e-mail ou mot de passe incorrect.',
            ]);
        }

        if ($user->isBlocked()) {
            return response()->json([
                'message' => $user->status === UserStatus::SUSPENDED
                    ? "Votre compte a été suspendu. Contactez l'administrateur de la plateforme pour en savoir plus."
                    : "Ce compte a été désactivé. Contactez l'administrateur de la plateforme pour le réactiver.",
                'reason' => $user->status === UserStatus::SUSPENDED ? 'suspended' : 'deactivated',
            ], 403);
        }

        $user->forceFill(['last_login_at' => now()])->save();

        $token = $user->createToken(
            $request->input('device_name', 'web'),
            expiresAt: $this->tokenExpiry($request->boolean('remember')),
        )->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => new UserResource($user->load('supplierProfile')),
        ]);
    }

    /**
     * « Se souvenir de moi » : la session dure jusqu'à la limite des jetons (sanctum.expiration, 7 jours).
     * Sinon elle s'arrête après auth.login.session_hours heures (le front garde aussi le jeton
     * en sessionStorage, effacé à la fermeture du navigateur).
     */
    private function tokenExpiry(bool $remember): ?\DateTimeInterface
    {
        if ($remember) {
            $minutes = config('sanctum.expiration');

            return $minutes ? now()->addMinutes((int) $minutes) : null;
        }

        return now()->addHours((int) config('auth.login.session_hours', 12));
    }

    public function me(Request $request): UserResource
    {
        return new UserResource($request->user()->load('supplierProfile'));
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Déconnecté.']);
    }
}
