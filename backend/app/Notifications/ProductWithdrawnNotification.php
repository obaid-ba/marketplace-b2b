<?php

namespace App\Notifications;

use App\Models\NotificationPreference;
use App\Models\Product;
use App\Models\User;
use App\Notifications\Concerns\RespectsNotificationPreferences;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Notification au fournisseur lorsqu'un produit est retiré du catalogue (SCRUM-72).
 */
class ProductWithdrawnNotification extends Notification implements ShouldQueue
{
    use Queueable, RespectsNotificationPreferences;

    public function __construct(public Product $product, public string $reason)
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

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("Produit « {$this->product->title} » retiré du catalogue")
            ->greeting("Bonjour {$notifiable->name},")
            ->line("Votre produit « {$this->product->title} » a été retiré du catalogue par la modération.")
            ->line("Motif : {$this->reason}")
            ->line('Vous pouvez corriger la fiche puis la republier depuis votre espace fournisseur.');
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'event' => $this->eventType(),
            'title' => 'Annonce retirée',
            'url' => '/fournisseur/produits',
            'event_type' => 'product.withdrawn',
            'product_id' => $this->product->id,
            'reason' => $this->reason,
            'message' => "Votre produit « {$this->product->title} » a été retiré du catalogue.",
        ];
    }

    protected function eventType(): string
    {
        return NotificationPreference::EVENT_ANNOUNCEMENT_REMOVED;
    }
}
