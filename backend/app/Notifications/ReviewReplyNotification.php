<?php

namespace App\Notifications;

use App\Models\NotificationPreference;
use App\Models\Review;
use App\Models\User;
use App\Notifications\Concerns\RespectsNotificationPreferences;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Notification envoyée à l'acheteur lorsque le fournisseur répond à son avis (SCRUM-65).
 */
class ReviewReplyNotification extends Notification implements ShouldQueue
{
    use Queueable, RespectsNotificationPreferences;

    public function __construct(
        public Review $review
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
            'event' => $this->eventType(),
            'title' => 'Réponse à votre avis',
            'url' => "/orders/{$this->review->order_id}",
            'event_type' => 'review.reply',
            'review_id' => $this->review->id,
            'order_id' => $this->review->order_id,
            'supplier_id' => $this->review->supplier_id,
            'message' => "Le fournisseur a répondu à votre avis sur la commande #{$this->review->order_id}.",
        ];
    }

    protected function eventType(): string
    {
        return NotificationPreference::EVENT_REVIEW;
    }
}
