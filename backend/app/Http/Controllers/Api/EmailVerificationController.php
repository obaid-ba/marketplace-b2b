<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/**
 * Vérification de l'adresse e-mail après l'inscription (SCRUM-22).
 * Le lien envoyé par e-mail est signé et ouvre une URL de l'API, qui vérifie
 * le compte puis redirige vers la page de connexion du frontend.
 */
class EmailVerificationController extends Controller
{
    public function verify(Request $request, string $id, string $hash): RedirectResponse
    {
        $user = User::findOrFail($id);

        abort_unless(hash_equals($hash, sha1($user->getEmailForVerification())), 403);

        if (! $user->hasVerifiedEmail()) {
            $user->markEmailAsVerified();

            if ($user->status === UserStatus::EMAIL_TO_VERIFY) {
                $user->forceFill(['status' => UserStatus::ACTIVE])->save();
            }

            event(new Verified($user));
        }

        return redirect()->away(
            rtrim((string) config('app.frontend_url'), '/').'/connexion?verifie=1'
        );
    }

    /**
     * Renvoie un nouveau lien de vérification (bouton « Renvoyer l'e-mail »).
     */
    public function resend(Request $request): JsonResponse
    {
        if ($request->user()->hasVerifiedEmail()) {
            return response()->json(['message' => 'Votre adresse e-mail est déjà vérifiée.']);
        }

        $request->user()->sendEmailVerificationNotification();

        return response()->json(['message' => 'Un nouvel e-mail de vérification a été envoyé.']);
    }
}
