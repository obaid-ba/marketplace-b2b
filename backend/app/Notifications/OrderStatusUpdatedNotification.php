<?php

namespace App\Notifications;

use App\Enums\OrderStatus;
use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Notification envoyée à l'acheteur lors de l'évolution du statut de sa commande (SCRUM-54, SCRUM-55).
 */
class OrderStatusUpdatedNotification extends Notification
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
     * Contenu de l'e-mail d'avancement de commande.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $statusLabel = $this->order->status->value;
        $orderId = $this->order->id;
        $frontendUrl = rtrim((string) config('app.frontend_url', env('FRONTEND_URL', 'http://localhost:5173')), '/');

        $mail = (new MailMessage)
            ->subject("Mise à jour de votre commande #{$orderId} : {$statusLabel}")
            ->greeting("Bonjour {$notifiable->name},")
            ->line("Le statut de votre commande #{$orderId} a évolué vers : « {$statusLabel} ».");

        if ($this->order->status === OrderStatus::SHIPPED) {
            $mail->line("Votre fournisseur a expédié votre commande. Elle est actuellement en cours d'acheminement.");
        } elseif ($this->order->status === OrderStatus::DELIVERED) {
            $mail->line("Votre fournisseur a marqué la commande comme livrée. Veuillez vérifier la conformité des articles reçus.");
        } elseif ($this->order->status === OrderStatus::CLOSED) {
            $mail->line("Votre commande est désormais clôturée.");
        }

        return $mail->action('Suivre ma commande', "{$frontendUrl}/orders/{$orderId}");
    }

    /**
     * Données enregistrées dans la table notifications (format JSON).
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'event_type' => 'order.status_updated',
            'order_id' => $this->order->id,
            'status' => $this->order->status->value,
            'buyer_id' => $this->order->buyer_id,
            'supplier_id' => $this->order->supplier_id,
            'message' => "Le statut de votre commande #{$this->order->id} est désormais « {$this->order->status->value} ».",
        ];
    }
}
