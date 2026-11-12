<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;

/**
 * Vérification de l'adresse e-mail (SCRUM-24).
 *
 * Le lien reçu par e-mail ouvre l'application React (/email/verifier?id=…&hash=…&expires=…&signature=…),
 * qui appelle ensuite verify() ci-dessous. Le lien est signé, expire (auth.verification.expire minutes)
 * et ne sert qu'une fois : une fois l'adresse vérifiée, il est refusé.
 */
class EmailVerificationController extends Controller
{
    public function verify(Request $request, int $id, string $hash): JsonResponse
    {
        // Signature calculée sur le chemin seul (absolute: false) : indépendante du domaine de l'API.
        if (! URL::hasCorrectSignature($request, absolute: false)) {
            return $this->invalidLink();
        }

        if (! URL::signatureHasNotExpired($request)) {
            return response()->json([
                'message' => 'Ce lien de vérification a expiré. Connectez-vous pour en recevoir un nouveau.',
                'reason' => 'expired',
            ], 410);
        }

        $user = User::find($id);

        if (! $user || ! hash_equals(sha1($user->getEmailForVerification()), $hash)) {
            return $this->invalidLink();
        }

        if ($user->hasVerifiedEmail()) {
            return response()->json([
                'message' => 'Ce lien a déjà été utilisé : votre adresse e-mail est déjà vérifiée.',
                'reason' => 'already_verified',
            ], 409);
        }

        $user->markEmailAsVerified();
        event(new Verified($user));

        return response()->json([
            'message' => 'Votre adresse e-mail est vérifiée.',
            'user' => new UserResource($user->load('supplierProfile')),
        ]);
    }

    /** « Renvoyer le lien » depuis la page « Consultez votre boîte mail » (limité, voir AppServiceProvider). */
    public function resend(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->hasVerifiedEmail()) {
            return response()->json([
                'message' => 'Votre adresse e-mail est déjà vérifiée.',
                'reason' => 'already_verified',
            ], 409);
        }

        $user->sendEmailVerificationNotification();

        return response()->json(['message' => 'Un nouveau lien vient de vous être envoyé.']);
    }

    private function invalidLink(): JsonResponse
    {
        return response()->json([
            'message' => "Ce lien de vérification n'est pas valide.",
            'reason' => 'invalid',
        ], 403);
    }
}
