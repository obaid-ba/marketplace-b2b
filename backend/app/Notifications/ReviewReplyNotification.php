<?php

namespace App\Notifications;

use App\Models\Review;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Notification envoyée à l'acheteur lorsque le fournisseur répond à son avis (SCRUM-65).
 */
class ReviewReplyNotification extends Notification
{
    use Queueable;

    public function __construct(
        public Review $review
    ) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $orderId = $this->review->order_id;
        $supplierName = $this->review->supplier?->company_name ?? 'Le fournisseur';
        $frontendUrl = rtrim((string) config('app.frontend_url', env('FRONTEND_URL', 'http://localhost:5173')), '/');

        return (new MailMessage)
            ->subject("Réponse du fournisseur à votre avis — Commande #{$orderId}")
            ->greeting("Bonjour {$notifiable->name},")
            ->line("{$supplierName} a répondu à votre avis sur la commande #{$orderId}.")
            ->line("Réponse : « {$this->review->supplier_reply} »")
            ->action('Voir la commande', "{$frontendUrl}/orders/{$orderId}");
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'event_type' => 'review.reply',
            'review_id' => $this->review->id,
            'order_id' => $this->review->order_id,
            'supplier_id' => $this->review->supplier_id,
            'message' => "Le fournisseur a répondu à votre avis sur la commande #{$this->review->order_id}.",
        ];
    }
}
