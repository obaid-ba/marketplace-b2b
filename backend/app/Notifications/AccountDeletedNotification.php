<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Compte supprimé par un administrateur, avec le motif (SCRUM-71). Toujours par e-mail : l'utilisateur ne peut plus se connecter.
 */
class AccountDeletedNotification extends Notification implements ShouldQueue
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
            ->subject('Votre compte a été supprimé')
            ->greeting("Bonjour {$notifiable->name},")
            ->line('Un administrateur de TijaraLink a supprimé votre compte. Vous ne pouvez plus vous connecter ; vos commandes et factures sont conservées.')
            ->line("Motif : {$this->reason}")
            ->line("Pour toute question, contactez l'administrateur de la plateforme.");
    }
}
