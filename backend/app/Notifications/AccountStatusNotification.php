<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Notification à un utilisateur dont le compte est suspendu, réactivé ou supprimé
 * par un administrateur (SCRUM-71).
 */
class AccountStatusNotification extends Notification
{
    use Queueable;

    public function __construct(
        public string $state,
        public ?string $reason = null,
    ) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $subject = match ($this->state) {
            'suspendu' => 'Votre compte a été suspendu',
            'désactivé' => 'Votre compte a été désactivé',
            default => 'Votre compte a été réactivé',
        };

        $mail = (new MailMessage)
            ->subject($subject)
            ->greeting("Bonjour {$notifiable->name},")
            ->line("Votre compte sur la marketplace a été {$this->state} par l'administration.");

        if ($this->reason) {
            $mail->line("Motif : {$this->reason}");
        }

        return $mail->line('Pour toute question, contactez l\'administrateur de la plateforme.');
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'event_type' => 'account.status_changed',
            'state' => $this->state,
            'reason' => $this->reason,
            'message' => "Votre compte a été {$this->state}.",
        ];
    }
}
