<?php

use App\Services\WhatsApp\SimulatedWhatsAppClient;

/*
| Notifications WhatsApp (SCRUM-133, règle R6) : repli automatique sur l'e-mail si l'envoi échoue.
|
| provider : « simulated » (rien n'est envoyé, l'envoi est seulement enregistré) ou « disabled ».
| Pour brancher un vrai fournisseur : une classe qui implémente App\Services\WhatsApp\WhatsAppClient,
| ajoutée à « drivers ».
*/
return [

    'provider' => env('WHATSAPP_PROVIDER', 'simulated'),

    'drivers' => [
        'simulated' => SimulatedWhatsAppClient::class,
    ],

    // Démonstration du repli : true fait échouer tous les envois simulés.
    'simulate_failure' => (bool) env('WHATSAPP_SIMULATE_FAILURE', false),

    // Réservés au futur fournisseur.
    'token' => env('WHATSAPP_TOKEN'),
    'sender' => env('WHATSAPP_SENDER'),
    'timeout' => (int) env('WHATSAPP_TIMEOUT', 5),

];
