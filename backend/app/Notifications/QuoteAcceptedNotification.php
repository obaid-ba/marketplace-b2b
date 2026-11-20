<?php

namespace App\Notifications;

use App\Models\NotificationPreference;
use App\Models\Order;
use App\Models\Quote;
use App\Models\User;
use App\Notifications\Concerns\RespectsNotificationPreferences;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Le porteur a accepté le devis : la commande est créée (SCRUM-48).
 */
class QuoteAcceptedNotification extends Notification implements ShouldQueue
{
    use Queueable, RespectsNotificationPreferences;

    public function __construct(public Quote $quote, public Order $order) {}

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
            'title' => 'Votre devis a été accepté',
            'message' => $this->quote->tender->title,
            'tender_id' => $this->quote->tender_id,
            'quote_id' => $this->quote->id,
            'order_id' => $this->order->id,
            'url' => '/fournisseur/devis',
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $this->quote->loadMissing('tender');

        return (new MailMessage)
            ->subject('Devis accepté : '.$this->quote->tender->title)
            ->line('Bonne nouvelle : le porteur de projet a accepté votre devis.')
            ->line('Demande : '.$this->quote->tender->title)
            ->line('Commande n° '.$this->order->id.' — montant '.number_format((float) $this->order->total, 2, ',', ' ').' TND')
            ->action('Voir mes devis', $this->frontendUrl('/fournisseur/devis'))
            ->line('La commande apparaîtra dans votre espace dès la mise en service du suivi des commandes.');
    }

    protected function eventType(): string
    {
        return NotificationPreference::EVENT_QUOTE_ACCEPTED;
    }
}
