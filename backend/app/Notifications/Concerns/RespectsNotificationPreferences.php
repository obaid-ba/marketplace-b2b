<?php

namespace App\Notifications\Concerns;

use App\Models\NotificationPreference;
use App\Models\User;

/**
 * Applique les préférences de notification (événement × canal) au moment de l'envoi.
 * Le contrôle est côté serveur : désactiver une case dans l'interface ne suffit pas
 * à contourner la règle, et les e-mails critiques restent toujours actifs.
 */
trait RespectsNotificationPreferences
{
    abstract protected function eventType(): string;

    /**
     * @return list<string>
     */
    protected function channelsFor(User $user): array
    {
        $channels = [];

        if (NotificationPreference::allows($user, $this->eventType(), NotificationPreference::CHANNEL_SITE)) {
            $channels[] = 'database';
        }

        if (NotificationPreference::allows($user, $this->eventType(), NotificationPreference::CHANNEL_EMAIL)) {
            $channels[] = 'mail';
        }

        // Un utilisateur ne peut pas se retrouver sans aucune trace d'un événement.
        return $channels === [] ? ['database'] : $channels;
    }

    protected function frontendUrl(string $path): string
    {
        return rtrim((string) config('app.frontend_url'), '/').$path;
    }
}
