<?php

namespace App\Notifications;

use App\Models\Dispute;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Notification à l'administrateur et au fournisseur lors de l'ouverture d'un litige
 * (SCRUM-67 / SCRUM-73).
 */
class DisputeOpenedNotification extends Notification
{
    use Queueable;

    public function __construct(public Dispute $dispute) {}

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
            ->subject("Litige #{$this->dispute->id} ouvert sur la commande #{$this->dispute->order_id}")
            ->greeting("Bonjour {$notifiable->name},")
            ->line("Un litige a été ouvert sur la commande #{$this->dispute->order_id}.")
            ->line("Motif : {$this->dispute->reason}")
            ->line("Description : {$this->dispute->description}")
            ->line('Les parties concernées seront informées de la décision de l\'administration.');
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'event_type' => 'dispute.opened',
            'dispute_id' => $this->dispute->id,
            'order_id' => $this->dispute->order_id,
            'reason' => $this->dispute->reason,
            'message' => "Un litige a été ouvert sur la commande #{$this->dispute->order_id}.",
        ];
    }
}
