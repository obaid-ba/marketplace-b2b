<?php

namespace App\Notifications;

use App\Models\NotificationPreference;
use App\Models\Tender;
use App\Models\User;
use App\Notifications\Concerns\RespectsNotificationPreferences;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Une demande correspond au fournisseur : diffusion automatique ou invitation (SCRUM-42 / SCRUM-49).
 */
class TenderReceivedNotification extends Notification implements ShouldQueue
{
    use Queueable, RespectsNotificationPreferences;

    public function __construct(
        public Tender $tender,
        public float $score = 0,
        public bool $invited = false,
    ) {}

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
            'title' => $this->invited ? 'Invitation à répondre à une demande' : 'Nouvelle demande reçue',
            'message' => $this->tender->title,
            'tender_id' => $this->tender->id,
            'score' => round($this->score, 2),
            'url' => '/fournisseur/demandes/'.$this->tender->id,
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $intro = $this->invited
            ? 'Un porteur de projet vous invite à répondre à sa demande.'
            : 'Une nouvelle demande correspond à votre activité.';

        return (new MailMessage)
            ->subject(($this->invited ? 'Invitation : ' : 'Nouvelle demande : ').$this->tender->title)
            ->line($intro)
            ->line('Demande : '.$this->tender->title)
            ->when($this->tender->budget, fn (MailMessage $mail) => $mail->line('Budget indicatif : '.number_format((float) $this->tender->budget, 2, ',', ' ').' TND'))
            ->when($this->tender->desired_deadline, fn (MailMessage $mail) => $mail->line('Délai souhaité : '.$this->tender->desired_deadline->format('d/m/Y')))
            ->action('Consulter la demande', $this->frontendUrl('/fournisseur/demandes/'.$this->tender->id))
            ->line('Vous pouvez envoyer un devis directement depuis la plateforme.');
    }

    protected function eventType(): string
    {
        return NotificationPreference::EVENT_TENDER_RECEIVED;
    }
}
