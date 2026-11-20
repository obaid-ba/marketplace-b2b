<?php

namespace App\Notifications;

use App\Models\NotificationPreference;
use App\Models\Order;
use App\Models\User;
use App\Notifications\Concerns\RespectsNotificationPreferences;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Commande validée après acceptation d'un devis (e-mail critique, SCRUM-48 / SCRUM-63).
 */
class OrderValidatedNotification extends Notification implements ShouldQueue
{
    use Queueable, RespectsNotificationPreferences;

    public function __construct(public Order $order) {}

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
            'title' => 'Commande validée',
            'message' => 'Commande n° '.$this->order->id,
            'order_id' => $this->order->id,
            'url' => '/porteur/commandes/'.$this->order->id,
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Commande validée n° '.$this->order->id)
            ->line('Votre commande a bien été créée à partir du devis accepté.')
            ->line('Montant : '.number_format((float) $this->order->total, 2, ',', ' ').' TND')
            ->action('Suivre la commande', $this->frontendUrl('/porteur/commandes/'.$this->order->id))
            ->line('Aucun paiement en ligne n’est demandé à cette étape.');
    }

    protected function eventType(): string
    {
        return NotificationPreference::EVENT_ORDER_VALIDATED;
    }
}
