<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Compte suspendu, avec le motif (SCRUM-118). Toujours par e-mail : l'utilisateur ne peut plus se connecter.
 */
class AccountSuspendedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public string $reason)
    {
        $this->afterCommit();
    }

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Votre compte a été suspendu')
            ->greeting("Bonjour {$notifiable->name},")
            ->line('Un administrateur de Marketplace B2B a suspendu votre compte. Vous ne pouvez plus vous connecter.')
            ->line("Motif : {$this->reason}")
            ->line("Pour toute question, contactez l'administrateur de la plateforme.");
    }
}
