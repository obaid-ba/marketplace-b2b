<?php

namespace App\Notifications;

use App\Models\Dispute;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Notification aux parties lors de la prise en charge ou de la décision d'un litige
 * (SCRUM-73).
 */
class DisputeUpdatedNotification extends Notification
{
    use Queueable;

    /**
     * @param  string  $event  `assigned` ou `decided`
     */
    public function __construct(public Dispute $dispute, public string $event) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $mail = (new MailMessage)
            ->subject("Litige #{$this->dispute->id} — mise à jour")
            ->greeting("Bonjour {$notifiable->name},")
            ->line("Le litige #{$this->dispute->id} sur la commande #{$this->dispute->order_id} a été mis à jour.");

        if ($this->event === 'assigned') {
            $mail->line('Votre litige a été pris en charge par l\'administration et est désormais « en cours ».');
        } else {
            $mail->line("Décision : {$this->dispute->decision}");
            if ($this->dispute->decision_note) {
                $mail->line("Note : {$this->dispute->decision_note}");
            }
        }

        return $mail->line('Connectez-vous à la plateforme pour consulter le détail.');
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'event_type' => 'dispute.'.$this->event,
            'dispute_id' => $this->dispute->id,
            'order_id' => $this->dispute->order_id,
            'status' => $this->dispute->status?->value,
            'decision' => $this->dispute->decision,
            'message' => $this->event === 'assigned'
                ? "Le litige #{$this->dispute->id} est en cours de traitement."
                : "Le litige #{$this->dispute->id} a été décidé.",
        ];
    }
}
