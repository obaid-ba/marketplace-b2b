<?php

use App\Services\Ai\GeminiAiClient;
use App\Services\Ai\SimulatedAiClient;

/*
| Service IA commun (SCRUM-119 / F25).
|
| provider : « simulated » (règles de calcul, aucun appel extérieur, aucune clé), « gemini » (API Gemini de
| Google, clé AI_API_KEY obligatoire) ou « disabled ».
| Pour brancher un vrai fournisseur : écrire une classe qui implémente App\Services\Ai\AiClient,
| puis l'ajouter à « drivers ». Le reste de l'application ne change pas.
*/
return [

    // Gemini sans clé (secret oublié sur Render, par exemple) : on reste en mode simulé plutôt que de couper l'IA.
    'provider' => env('AI_PROVIDER', 'simulated') === 'gemini' && blank(env('AI_API_KEY'))
        ? 'simulated'
        : env('AI_PROVIDER', 'simulated'),

    'drivers' => [
        'simulated' => SimulatedAiClient::class,
        'mock' => SimulatedAiClient::class, // ancien nom (S6), accepté dans les .env existants
        'gemini' => GeminiAiClient::class,
    ],

    // Fournisseur réel. AI_MODEL vide : modèle par défaut du pilote (GeminiAiClient::DEFAULT_MODEL).
    'api_key' => env('AI_API_KEY'),
    'model' => env('AI_MODEL'),
    'timeout' => (int) env('AI_TIMEOUT', 30),

    // Générations par heure et par utilisateur. Relire un résumé déjà généré ne compte pas.
    'rate_limit' => (int) env('AI_RATE_LIMIT', 20),

];
