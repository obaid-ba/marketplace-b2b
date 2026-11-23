<?php

use App\Services\Ai\SimulatedAiClient;

/*
| Service IA commun (SCRUM-119 / F25).
|
| provider : « simulated » (règles de calcul, aucun appel extérieur, aucune clé) ou « disabled ».
| Pour brancher un vrai fournisseur : écrire une classe qui implémente App\Services\Ai\AiClient,
| puis l'ajouter à « drivers ». Le reste de l'application ne change pas.
*/
return [

    'provider' => env('AI_PROVIDER', 'simulated'),

    'drivers' => [
        'simulated' => SimulatedAiClient::class,
    ],

    // Réservés au futur fournisseur (Q8).
    'api_key' => env('AI_API_KEY'),
    'model' => env('AI_MODEL'),
    'timeout' => (int) env('AI_TIMEOUT', 30),

    // Générations par heure et par utilisateur. Relire un résumé déjà généré ne compte pas.
    'rate_limit' => (int) env('AI_RATE_LIMIT', 20),

];
