<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Fournisseur d'IA (SCRUM-80 / F25)
    |--------------------------------------------------------------------------
    |
    | `provider` vaut `mock` par défaut : aucune clé n'est nécessaire et les
    | réponses sont déterministes (démonstration hors ligne et tests). Un
    | fournisseur réel sera branché ici lorsque le fournisseur et la clé
    | auront été validés (question Q8). La clé ne doit jamais être commitée :
    | elle reste dans backend/.env.
    |
    */

    'provider' => env('AI_PROVIDER', 'mock'),

    'api_key' => env('AI_API_KEY'),

    'base_url' => env('AI_BASE_URL', 'https://api.openai.com/v1'),

    'model' => env('AI_MODEL', 'gpt-4o-mini'),

    'timeout' => (int) env('AI_TIMEOUT', 15),

    // Nombre d'appels autorisés par utilisateur et par minute.
    'rate_limit_per_minute' => (int) env('AI_RATE_LIMIT', 20),

];
