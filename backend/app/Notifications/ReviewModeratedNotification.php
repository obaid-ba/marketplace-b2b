<?php

namespace App\Notifications;

use App\Models\Review;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Notification à l'auteur d'un avis après modération (SCRUM-74).
 */
class ReviewModeratedNotification extends Notification
{
    use Queueable;

    public function __construct(
        public Review $review,
        public string $decision,
        public ?string $reason = null,
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
        $subject = $this->decision === 'masqué'
            ? 'Votre avis a été masqué'
            : 'Votre avis a été conservé';

        $mail = (new MailMessage)
            ->subject($subject)
            ->greeting("Bonjour {$notifiable->name},")
            ->line("Après examen, votre avis sur la commande #{$this->review->order_id} a été {$this->decision} par la modération.");

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
            'event_type' => 'review.moderated',
            'review_id' => $this->review->id,
            'decision' => $this->decision,
            'reason' => $this->reason,
            'message' => "Votre avis a été {$this->decision} par la modération.",
        ];
    }
}
