<?php

namespace App\Http\Resources;

use App\Enums\OrderStatus;
use App\Models\Order;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Commande créée par acceptation d'un devis (SCRUM-48).
 *
 * @mixin Order
 */
class OrderResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'origin' => $this->origin,
            'origin_label' => $this->origin === 'devis' ? 'Devis accepté' : 'Catalogue',
            'total' => (float) $this->total,
            'status' => $this->status?->value,
            'status_label' => $this->statusLabel(),
            'created_at' => $this->created_at?->toIso8601String(),
            'items_count' => $this->whenCounted('items'),
            'supplier' => $this->whenLoaded('supplier', fn () => $this->supplier ? [
                'id' => $this->supplier->id,
                'company_name' => $this->supplier->company_name,
                'rating_avg' => (float) $this->supplier->rating_avg,
                'reviews_count' => (int) $this->supplier->reviews_count,
                'professional_email' => $this->supplier->professional_email,
                'professional_phone' => $this->supplier->professional_phone,
            ] : null),
            'items' => $this->whenLoaded('items', fn () => $this->items->map(fn ($item) => [
                'id' => $item->id,
                'label' => $item->label,
                'quantity' => (int) $item->quantity,
                'unit_price' => (float) $item->unit_price,
                'total' => (float) $item->unit_price * (int) $item->quantity,
            ])->values()),
            'quote' => $this->whenLoaded('quote', fn () => $this->quote ? new QuoteResource($this->quote) : null),
            'status_history' => $this->whenLoaded('statusHistory', fn () => $this->statusHistory->map(fn ($history) => [
                'id' => $history->id,
                'status' => $history->status?->value,
                'status_label' => $this->labelFor($history->status),
                'changed_by' => $history->relationLoaded('changedBy') ? $history->changedBy?->name : null,
                'changed_at' => $history->changed_at?->toIso8601String(),
            ])->values()),
        ];
    }

    private function statusLabel(): ?string
    {
        return $this->labelFor($this->status);
    }

    private function labelFor(?OrderStatus $status): ?string
    {
        return match ($status) {
            OrderStatus::VALIDATED => 'Validée',
            OrderStatus::IN_PREPARATION => 'En préparation',
            OrderStatus::IN_DELIVERY => 'En livraison',
            OrderStatus::DELIVERED => 'Livrée',
            OrderStatus::CLOSED => 'Clôturée',
            default => null,
        };
    }
}
