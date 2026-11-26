<?php

namespace App\Services\WhatsApp;

use App\Models\User;

/**
 * Qui peut recevoir des messages WhatsApp (SCRUM-133).
 */
class WhatsAppSettings
{
    public function isAvailable(): bool
    {
        return array_key_exists((string) config('whatsapp.provider'), (array) config('whatsapp.drivers'));
    }

    public function isSimulated(): bool
    {
        return config('whatsapp.provider') === SimulatedWhatsAppClient::NAME;
    }

    /**
     * Numéro au format international (E.164), ou null s'il n'est pas utilisable.
     */
    public function numberFor(User $user): ?string
    {
        $number = preg_replace('/[\s().-]/', '', (string) $user->phone);

        return preg_match('/^\+216\d{8}$/', $number) ? $number : null;
    }

    /**
     * Service actif, consentement donné et numéro valide.
     */
    public function canReceive(User $user): bool
    {
        return $this->isAvailable() && $user->whatsapp_opted_in_at !== null && $this->numberFor($user) !== null;
    }

    public function maskedNumberFor(User $user): ?string
    {
        $number = $this->numberFor($user);

        return $number === null ? null : '+216 •• ••• '.substr($number, -3);
    }
}
