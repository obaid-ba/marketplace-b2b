<?php

namespace App\Http\Resources;

use App\Enums\UserRole;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Notification du centre de notifications (SCRUM-62).
 *
 * @mixin \Illuminate\Notifications\DatabaseNotification
 */
class NotificationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $data = $this->data ?? [];

        return [
            'id' => $this->id,
            'event' => $data['event'] ?? $data['event_type'] ?? null,
            'title' => $data['title'] ?? $this->fallbackTitle($data),
            'message' => $data['message'] ?? null,
            'url' => $data['url'] ?? $this->fallbackUrl($data, $request),
            'read_at' => $this->read_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }

    /**
     * Les notifications de commandes et d'avis (S4) n'enregistrent ni titre ni lien : on les déduit.
     *
     * @param  array<string, mixed>  $data
     */
    private function fallbackTitle(array $data): string
    {
        $event = (string) ($data['event_type'] ?? '');

        return match (true) {
            $event === 'review.reply' || str_contains($event, 'reply') => 'Réponse à votre avis',
            str_starts_with($event, 'review') => 'Nouvel avis',
            str_starts_with($event, 'order') => 'Commande',
            default => 'Notification',
        };
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function fallbackUrl(array $data, Request $request): ?string
    {
        $role = $request->user()?->role;

        return match (true) {
            isset($data['review_id']) && $role === UserRole::Supplier => '/fournisseur/avis',
            isset($data['order_id']) && $role !== UserRole::Admin => '/orders/'.$data['order_id'],
            default => null,
        };
    }
}
