<?php

namespace App\Notifications;

use App\Enums\UserRole;
use App\Models\Dispute;
use App\Models\NotificationPreference;
use App\Models\User;
use App\Notifications\Concerns\RespectsNotificationPreferences;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Litige ouvert (fournisseur et admins) ou pris en charge (acheteur et fournisseur) — SCRUM-117 / F23.
 */
class DisputeUpdatedNotification extends Notification implements ShouldQueue
{
    use Queueable, RespectsNotificationPreferences;

    public const OPENED = 'opened';

    public const TAKEN = 'taken';

    public function __construct(public Dispute $dispute, public string $step)
    {
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
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'event' => $this->eventType(),
            'title' => $this->title(),
            'message' => "Commande n° {$this->dispute->order_id} — {$this->dispute->reason}",
            'dispute_id' => $this->dispute->id,
            'url' => $this->path($notifiable),
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("{$this->title()} — commande n° {$this->dispute->order_id}")
            ->greeting("Bonjour {$notifiable->name},")
            ->line($this->step === self::OPENED
                ? "Un problème a été signalé sur la commande n° {$this->dispute->order_id}."
                : "Un administrateur examine le litige de la commande n° {$this->dispute->order_id}.")
            ->line("Motif : {$this->dispute->reason}")
            ->action('Voir le litige', $this->frontendUrl($this->path($notifiable)));
    }

    protected function eventType(): string
    {
        return NotificationPreference::EVENT_DISPUTE_UPDATE;
    }

    private function title(): string
    {
        return $this->step === self::OPENED ? 'Litige ouvert' : 'Litige pris en charge';
    }

    private function path(object $notifiable): string
    {
        $admin = $notifiable instanceof User && $notifiable->hasRole(UserRole::Admin);

        return ($admin ? '/admin/litiges/' : '/litiges/').$this->dispute->id;
    }
}
