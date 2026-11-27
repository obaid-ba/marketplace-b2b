<?php

namespace App\Notifications;

use App\Enums\UserRole;
use App\Models\Message;
use App\Models\NotificationPreference;
use App\Models\User;
use App\Notifications\Concerns\RespectsNotificationPreferences;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

/**
 * Nouveau message reçu (SCRUM-60). Envoyée au premier message non lu de la conversation seulement.
 */
class NewMessageNotification extends Notification implements ShouldQueue
{
    use Queueable, RespectsNotificationPreferences;

    public function __construct(public Message $message)
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
            'title' => 'Nouveau message de '.$this->senderName(),
            'message' => $this->preview(),
            'conversation_id' => $this->message->conversation_id,
            'url' => $this->path($notifiable),
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Nouveau message de '.$this->senderName())
            ->greeting("Bonjour {$notifiable->name},")
            ->line($this->senderName().' vous a écrit :')
            ->line('« '.$this->preview().' »')
            ->action('Répondre', $this->frontendUrl($this->path($notifiable)));
    }

    protected function eventType(): string
    {
        return NotificationPreference::EVENT_MESSAGE_RECEIVED;
    }

    private function preview(): string
    {
        return $this->message->body !== ''
            ? Str::limit($this->message->body, 140)
            : 'Pièce jointe : '.$this->message->attachment_name;
    }

    private function senderName(): string
    {
        $sender = $this->message->sender;

        return $sender?->supplierProfile?->company_name
            ?? $sender?->buyerProfile?->organization
            ?? $sender?->name
            ?? 'un utilisateur';
    }

    private function path(object $notifiable): string
    {
        $space = $notifiable instanceof User && $notifiable->hasRole(UserRole::Supplier) ? '/fournisseur' : '/porteur';

        return "{$space}/messagerie/{$this->message->conversation_id}";
    }
}
