<?php

namespace App\Notifications;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Notification envoyée au fournisseur lorsque l'acheteur confirme la réception de sa commande (SCRUM-56).
 */
class OrderClosedNotification extends Notification
{
    use Queueable;

    public function __construct(
        public Order $order
    ) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    /**
     * Contenu de l'e-mail informant le fournisseur de la clôture de la commande.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $orderId = $this->order->id;
        $frontendUrl = rtrim((string) config('app.frontend_url', env('FRONTEND_URL', 'http://localhost:5173')), '/');
        $buyerName = $this->order->buyer?->organization ?? $this->order->buyer?->user?->name ?? 'L\'acheteur';

        return (new MailMessage)
            ->subject("Commande #{$orderId} réceptionnée et clôturée")
            ->greeting("Bonjour {$notifiable->name},")
            ->line("L'acheteur ({$buyerName}) a confirmé la bonne réception de la commande #{$orderId}.")
            ->line("La commande est désormais clôturée et la facture correspondante a été générée.")
            ->action('Consulter la commande', "{$frontendUrl}/orders/{$orderId}");
    }

    /**
     * Données enregistrées en base (table notifications).
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'event_type' => 'order.closed',
            'order_id' => $this->order->id,
            'status' => $this->order->status->value,
            'buyer_id' => $this->order->buyer_id,
            'supplier_id' => $this->order->supplier_id,
            'message' => "La commande #{$this->order->id} a été confirmée et clôturée par l'acheteur.",
        ];
    }
}
