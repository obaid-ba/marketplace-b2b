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
 * Un fournisseur a envoyé (ou mis à jour) son devis (SCRUM-45).
 */
class NewQuoteNotification extends Notification implements ShouldQueue
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
        $quote = $this->quote->loadMissing(['tender', 'supplier']);

        return [
            'event' => $this->eventType(),
            'title' => 'Nouveau devis reçu',
            'message' => $quote->supplier->company_name.' — '.$quote->tender->title,
            'tender_id' => $quote->tender_id,
            'quote_id' => $quote->id,
            'amount' => (float) $quote->amount,
            'url' => '/porteur/demandes/'.$quote->tender_id.'/devis',
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $this->quote->loadMissing(['tender', 'supplier']);

        return (new MailMessage)
            ->subject('Nouveau devis : '.$this->quote->tender->title)
            ->line($this->quote->supplier->company_name.' a envoyé un devis pour votre demande.')
            ->line('Demande : '.$this->quote->tender->title)
            ->line('Montant : '.number_format((float) $this->quote->amount, 2, ',', ' ').' TND')
            ->line('Délai proposé : '.$this->quote->delivery_days.' jour(s)')
            ->action('Comparer les devis', $this->frontendUrl('/porteur/demandes/'.$this->quote->tender_id.'/devis'))
            ->line('Vous pouvez accepter un devis depuis la page de comparaison.');
    }

    protected function eventType(): string
    {
        return NotificationPreference::EVENT_QUOTE_RECEIVED;
    }
}
