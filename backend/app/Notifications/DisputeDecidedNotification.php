<?php

namespace App\Notifications;

use App\Models\Dispute;
use App\Models\NotificationPreference;
use App\Models\User;
use App\Notifications\Concerns\RespectsNotificationPreferences;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Décision de l'administrateur, avec son motif, envoyée aux deux parties. L'e-mail est critique : toujours envoyé.
 */
class DisputeDecidedNotification extends Notification implements ShouldQueue
{
    use Queueable, RespectsNotificationPreferences;

    public function __construct(public Dispute $dispute)
    {
        $this->afterCommit();
    }

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return $notifiable instanceof User ? $this->channelsFor($notifiable) : ['database'];
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'event' => $this->eventType(),
            'title' => 'Décision de litige : '.$this->dispute->decision->value,
            'message' => "Commande n° {$this->dispute->order_id} — {$this->dispute->decision_note}",
            'dispute_id' => $this->dispute->id,
            'url' => "/litiges/{$this->dispute->id}",
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("Décision du litige — commande n° {$this->dispute->order_id}")
            ->greeting("Bonjour {$notifiable->name},")
            ->line("Une décision a été rendue pour le litige de la commande n° {$this->dispute->order_id}.")
            ->line('Décision : '.$this->dispute->decision->value)
            ->line('Motif : '.$this->dispute->decision_note)
            ->action('Voir le litige', $this->frontendUrl("/litiges/{$this->dispute->id}"));
    }

    protected function eventType(): string
    {
        return NotificationPreference::EVENT_DISPUTE_DECISION;
    }
}
