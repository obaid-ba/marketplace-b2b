<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Compte réactivé (SCRUM-118).
 */
class AccountReactivatedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct()
    {
        $this->afterCommit();
    }

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Votre compte est réactivé')
            ->greeting("Bonjour {$notifiable->name},")
            ->line('Un administrateur a réactivé votre compte TijaraLink.')
            ->action('Se connecter', rtrim((string) config('app.frontend_url'), '/').'/connexion');
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'event' => 'account_reactivated',
            'title' => 'Compte réactivé',
            'message' => 'Un administrateur a réactivé votre compte.',
            'url' => null,
        ];
    }
}
