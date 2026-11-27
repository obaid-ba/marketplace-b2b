<?php

namespace App\Notifications;

use App\Models\NotificationPreference;
use App\Models\Quote;
use App\Models\User;
use App\Notifications\Concerns\RespectsNotificationPreferences;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Un autre devis a été accepté : ce devis est refusé et la demande clôturée (SCRUM-48).
 */
class QuoteRejectedNotification extends Notification implements ShouldQueue
{
    use Queueable, RespectsNotificationPreferences;

    public function __construct(public Quote $quote) {}

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
        $this->quote->loadMissing('tender');

        return [
            'event' => $this->eventType(),
            'title' => 'Devis non retenu',
            'message' => $this->quote->tender->title,
            'tender_id' => $this->quote->tender_id,
            'quote_id' => $this->quote->id,
            'url' => '/fournisseur/devis',
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $this->quote->loadMissing('tender');

        return (new MailMessage)
            ->subject('Devis non retenu : '.$this->quote->tender->title)
            ->line("Le porteur de projet a retenu un autre devis pour cette demande.")
            ->line('Demande : '.$this->quote->tender->title)
            ->action('Voir mes devis', $this->frontendUrl('/fournisseur/devis'))
            ->line('Merci pour votre réponse.');
    }

    protected function eventType(): string
    {
        return NotificationPreference::EVENT_QUOTE_REJECTED;
    }
}
