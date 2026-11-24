<?php

namespace App\Notifications;

use App\Models\Product;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Notification au fournisseur lorsqu'un produit est retiré du catalogue (SCRUM-72).
 */
class ProductWithdrawnNotification extends Notification
{
    use Queueable;

    public function __construct(public Product $product, public string $reason) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
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
            'event_type' => 'product.withdrawn',
            'product_id' => $this->product->id,
            'reason' => $this->reason,
            'message' => "Votre produit « {$this->product->title} » a été retiré du catalogue.",
        ];
    }
}
