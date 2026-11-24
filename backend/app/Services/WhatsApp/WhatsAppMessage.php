<?php

namespace App\Services\WhatsApp;

/**
 * Message sortant : un titre et un lien, rien de privé (le numéro n'est pas vérifié).
 * Les fournisseurs exigent un modèle approuvé pour un message à l'initiative de l'entreprise :
 * title et url en sont les deux variables.
 */
final readonly class WhatsAppMessage
{
    public function __construct(
        public string $to,
        public string $title,
        public string $url,
    ) {}
}
