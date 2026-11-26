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
use Illuminate\Support\Str;

/**
 * Notification à l'auteur d'un avis après modération (SCRUM-74).
 */
class ReviewModeratedNotification extends Notification implements ShouldQueue
{
    use Queueable, RespectsNotificationPreferences;

    public function __construct(
        public Review $review,
        public string $decision,
        public ?string $reason = null,
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
        $subject = $this->isSupplier($notifiable) ? 'Un avis sur votre entreprise' : 'Votre avis';

        $mail = (new MailMessage)
            ->subject("{$subject} a été {$this->decision}")
            ->greeting("Bonjour {$notifiable->name},")
            ->line("Après examen, {$this->sentence($notifiable)}");

        if ($this->reason) {
            $mail->line("Motif : {$this->reason}");
        }

        return $mail->line('Merci de contribuer à la qualité des évaluations sur la plateforme.');
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'event' => $this->eventType(),
            'title' => "Avis {$this->decision}",
            'url' => $this->isSupplier($notifiable) ? '/fournisseur/avis' : "/orders/{$this->review->order_id}",
            'event_type' => 'review.moderated',
            'review_id' => $this->review->id,
            'decision' => $this->decision,
            'reason' => $this->reason,
            'message' => Str::ucfirst($this->sentence($notifiable)),
        ];
    }

    /** L'auteur et le fournisseur reçoivent la même décision, avec un texte adapté (SCRUM-74). */
    private function isSupplier(object $notifiable): bool
    {
        return $notifiable instanceof User && $notifiable->hasRole(UserRole::Supplier);
    }

    private function sentence(object $notifiable): string
    {
        $review = $this->isSupplier($notifiable) ? "l'avis reçu" : 'votre avis';

        return "{$review} sur la commande #{$this->review->order_id} a été {$this->decision} par la modération.";
    }

    protected function eventType(): string
    {
        return NotificationPreference::EVENT_REVIEW;
    }
}
