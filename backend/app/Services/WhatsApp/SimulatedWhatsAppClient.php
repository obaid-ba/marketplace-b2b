<?php

namespace App\Services\WhatsApp;

use App\Enums\WhatsAppStatus;
use RuntimeException;

/**
 * Mode simulé : rien n'est envoyé. Le statut « simulé » ne se confond jamais avec un envoi réel.
 */
class SimulatedWhatsAppClient implements WhatsAppClient
{
    public const NAME = 'simulated';

    public function send(WhatsAppMessage $message): WhatsAppResult
    {
        if (config('whatsapp.simulate_failure')) {
            throw new RuntimeException('Échec simulé.');
        }

        return new WhatsAppResult(WhatsAppStatus::SIMULATED, self::NAME);
    }
}
