<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;

/**
 * Mot de passe oublié (SCRUM-26).
 *
 * 1. forgot() : envoie un lien vers l'application React (/mot-de-passe/nouveau?token=…&email=…).
 *    La réponse est la même que l'adresse existe ou non.
 * 2. reset()  : enregistre le nouveau mot de passe. Le jeton expire (auth.passwords.users.expire minutes)
 *    et est supprimé après usage : le lien ne sert qu'une fois.
 */
class PasswordResetController extends Controller
{
    public function forgot(ForgotPasswordRequest $request): JsonResponse
    {
        // Le résultat (compte inconnu, envoi trop rapproché…) n'est volontairement pas communiqué.
        Password::sendResetLink(['email' => strtolower($request->input('email'))]);

        return response()->json([
            'message' => 'Si un compte existe pour cette adresse, vous allez recevoir un e-mail avec un lien pour choisir un nouveau mot de passe.',
        ]);
    }

    public function reset(ResetPasswordRequest $request): JsonResponse
    {
        $credentials = [
            'email' => strtolower($request->input('email')),
            'password' => $request->input('password'),
            'password_confirmation' => $request->input('password_confirmation'),
            'token' => $request->input('token'),
        ];

        $status = Password::reset($credentials, function (User $user, string $password) {
            $user->forceFill([
                'password' => $password,
                'remember_token' => Str::random(60),
            ])->save();

            // Sécurité : toutes les sessions ouvertes (web, mobile) sont fermées.
            $user->tokens()->delete();

            // Le lien a été reçu sur cette adresse : elle est donc confirmée.
            if (! $user->hasVerifiedEmail()) {
                $user->markEmailAsVerified();
            }

            event(new PasswordReset($user));
        });

        if ($status !== Password::PASSWORD_RESET) {
            return response()->json([
                'message' => "Ce lien de réinitialisation n'est pas valide ou a expiré. Faites une nouvelle demande.",
                'reason' => 'invalid_token',
            ], 422);
        }

        return response()->json([
            'message' => 'Votre mot de passe a été modifié. Vous pouvez maintenant vous connecter.',
        ]);
    }
}
