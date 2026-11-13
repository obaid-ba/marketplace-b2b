<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Ferme les pages connectées tant que l'adresse e-mail n'est pas vérifiée (SCRUM-24).
 * Le champ "reason" permet au front d'envoyer l'utilisateur sur « Consultez votre boîte mail ».
 */
class EnsureEmailIsVerified
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && ! $user->hasVerifiedEmail()) {
            return response()->json([
                'message' => 'Vérifiez votre adresse e-mail pour accéder à votre espace.',
                'reason' => 'email_not_verified',
            ], 403);
        }

        return $next($request);
    }
}
