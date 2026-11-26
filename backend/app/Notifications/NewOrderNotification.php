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
 * Notification envoyée au fournisseur lors de la réception d'une nouvelle commande (SCRUM-51).
 */
class NewOrderNotification extends Notification implements ShouldQueue
{
    use Queueable, RespectsNotificationPreferences;

    public function __construct(
        public Order $order
    ) {
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
     * E-mail d'information de nouvelle commande.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $itemsCount = $this->order->items()->count();
        $formattedTotal = number_format((float) $this->order->total, 2, ',', ' ');

        return (new MailMessage)
            ->subject("Nouvelle commande #{$this->order->id} reçue")
            ->greeting("Bonjour {$notifiable->name},")
            ->line("Vous avez reçu une nouvelle commande directe #{$this->order->id} d'un montant de {$formattedTotal} TND.")
            ->line("Nombre d'articles : {$itemsCount}")
            ->line("Statut : {$this->order->status->value}")
            ->action(
                'Voir la commande',
                rtrim((string) config('app.frontend_url', env('FRONTEND_URL', 'http://localhost:5173')), '/') . "/orders/{$this->order->id}"
            )
            ->line('Veuillez traiter la commande dans les meilleurs délais conformément à vos engagements de livraison.');
    }

    /**
     * Enregistrement en base de données (table notifications).
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'event' => $this->eventType(),
            'title' => "Nouvelle commande n° {$this->order->id}",
            'url' => "/orders/{$this->order->id}",
            'event_type' => 'order.created',
            'order_id' => $this->order->id,
            'buyer_id' => $this->order->buyer_id,
            'supplier_id' => $this->order->supplier_id,
            'total' => (float) $this->order->total,
            'status' => $this->order->status->value,
            'message' => "Nouvelle commande #{$this->order->id} reçue d'un montant de {$this->order->total} TND.",
        ];
    }

    protected function eventType(): string
    {
        return NotificationPreference::EVENT_ORDER_VALIDATED;
    }
}
