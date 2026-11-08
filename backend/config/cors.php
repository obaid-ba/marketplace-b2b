<?php

// L'application React (web) et l'application mobile appellent l'API depuis une autre origine.
return [

    'paths' => ['api/*'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_filter(explode(',', (string) env('FRONTEND_URLS', 'http://localhost:5173'))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    // Authentification par jeton Bearer : pas de cookies cross-origin.
    'supports_credentials' => false,

];
