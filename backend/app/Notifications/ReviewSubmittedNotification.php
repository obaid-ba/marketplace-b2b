<?php

namespace App\Notifications;

use App\Enums\UserRole;
use App\Models\NotificationPreference;
use App\Models\Review;
use App\Models\User;
use App\Notifications\Concerns\RespectsNotificationPreferences;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Notification envoyée au fournisseur lorsqu'un acheteur dépose un avis sur sa commande (SCRUM-64).
 * Inclut une alerte prioritaire si la note est ≤ 2 étoiles.
 */
class ReviewSubmittedNotification extends Notification implements ShouldQueue
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
        $rating = $this->review->rating;
        $stars = str_repeat('★', $rating) . str_repeat('☆', 5 - $rating);
        $frontendUrl = rtrim((string) config('app.frontend_url', env('FRONTEND_URL', 'http://localhost:5173')), '/');
        $buyerName = $this->review->buyer?->organization ?? $this->review->buyer?->user?->name ?? 'Un acheteur';

        $mail = (new MailMessage)
            ->subject($rating <= 2
                ? "⚠️ Avis critique reçu ({$rating}/5) — Commande #{$orderId}"
                : "Nouvel avis reçu ({$rating}/5) — Commande #{$orderId}")
            ->greeting("Bonjour {$notifiable->name},")
            ->line("{$buyerName} a laissé un avis sur la commande #{$orderId}.")
            ->line("Note attribuée : {$stars} ({$rating}/5)");

        if ($this->review->comment) {
            $mail->line("Commentaire : « {$this->review->comment} »");
        }

        if ($rating <= 2) {
            $mail->line('⚠️ Cet avis est critique. Nous vous recommandons de répondre rapidement pour maintenir la confiance de vos clients.');
        }

        return $mail->action('Voir mes avis', "{$frontendUrl}/fournisseur/avis");
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'event' => $this->eventType(),
            'title' => $this->review->rating <= 2 ? 'Avis critique' : 'Nouvel avis',
            'url' => $notifiable instanceof User && $notifiable->hasRole(UserRole::Admin) ? '/admin/avis' : '/fournisseur/avis',
            'event_type' => $this->review->rating <= 2 ? 'review.critical' : 'review.submitted',
            'review_id' => $this->review->id,
            'order_id' => $this->review->order_id,
            'buyer_id' => $this->review->buyer_id,
            'supplier_id' => $this->review->supplier_id,
            'rating' => $this->review->rating,
            'is_critical' => $this->review->rating <= 2,
            'message' => $this->review->rating <= 2
                ? "⚠️ Avis critique ({$this->review->rating}/5) reçu pour la commande #{$this->review->order_id}."
                : "Nouvel avis ({$this->review->rating}/5) reçu pour la commande #{$this->review->order_id}.",
        ];
    }

    protected function eventType(): string
    {
        return NotificationPreference::EVENT_REVIEW;
    }
}
