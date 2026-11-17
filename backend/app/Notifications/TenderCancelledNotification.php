<?php

namespace App\Notifications;

use App\Models\NotificationPreference;
use App\Models\Tender;
use App\Models\User;
use App\Notifications\Concerns\RespectsNotificationPreferences;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Le porteur a annulé une demande à laquelle le fournisseur avait répondu (SCRUM-43).
 */
class TenderCancelledNotification extends Notification implements ShouldQueue
{
    use Queueable, RespectsNotificationPreferences;

    public function __construct(public Tender $tender) {}

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
            'title' => 'Demande annulée',
            'message' => $this->tender->title,
            'tender_id' => $this->tender->id,
            'url' => '/fournisseur/demandes/'.$this->tender->id,
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Demande annulée : '.$this->tender->title)
            ->line("Le porteur de projet a annulé la demande à laquelle vous aviez répondu.")
            ->line('Demande : '.$this->tender->title)
            ->action('Voir la demande', $this->frontendUrl('/fournisseur/demandes/'.$this->tender->id))
            ->line('Aucun devis ne sera accepté pour cette demande.');
    }

    protected function eventType(): string
    {
        return NotificationPreference::EVENT_TENDER_CANCELLED;
    }
}
