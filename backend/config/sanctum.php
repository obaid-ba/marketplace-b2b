<?php

use Laravel\Sanctum\Sanctum;

return [

    /*
    | Domaines "stateful" (cookies). Non utilisés : l'API fonctionne par jeton
    | Bearer pour le web comme pour le mobile. Laissé vide volontairement.
    */
    'stateful' => [],

    'guard' => ['web'],

    // Durée de vie des jetons en minutes (7 jours). null = pas d'expiration.
    'expiration' => env('SANCTUM_TOKEN_EXPIRATION', 60 * 24 * 7),

    'token_prefix' => env('SANCTUM_TOKEN_PREFIX', ''),

    'middleware' => [
        'authenticate_session' => Laravel\Sanctum\Http\Middleware\AuthenticateSession::class,
        'encrypt_cookies' => Illuminate\Cookie\Middleware\EncryptCookies::class,
        'validate_csrf_token' => Illuminate\Foundation\Http\Middleware\ValidateCsrfToken::class,
    ],

];
