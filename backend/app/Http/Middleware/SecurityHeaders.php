<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * En-têtes de sécurité de toutes les réponses de l'API (SCRUM-90) :
 * - pas d'interprétation d'un JSON comme du HTML ou du script (nosniff, CSP « default-src 'none' ») ;
 * - pas d'affichage dans un cadre d'un autre site (clickjacking) ;
 * - pas de fuite de l'adresse de la page dans les en-têtes Referer.
 * Le jeton est envoyé dans l'en-tête Authorization (jamais dans un cookie) : pas d'attaque CSRF possible.
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'DENY');
        $response->headers->set('Referrer-Policy', 'no-referrer');
        $response->headers->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

        // Les fichiers téléchargés (PDF, pièces jointes) gardent leur propre type ; le JSON ne s'exécute jamais.
        if (str_contains((string) $response->headers->get('Content-Type'), 'json')) {
            $response->headers->set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
        }

        if ($request->isSecure()) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        return $response;
    }
}
