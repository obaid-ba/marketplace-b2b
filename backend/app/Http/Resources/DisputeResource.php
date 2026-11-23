<?php

namespace App\Http\Resources;

use App\Enums\UserRole;
use App\Models\Dispute;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Litige. Les coordonnées des parties et l'administrateur assigné ne sont visibles que par les admins.
 *
 * @mixin Dispute
 */
class DisputeResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $isAdmin = (bool) $request->user()?->hasRole(UserRole::Admin);
        $order = $this->order;

        return [
            'id' => $this->id,
            'order_id' => $this->order_id,
            'reason' => $this->reason,
            'description' => $this->description,
            'status' => $this->status->value,
            'decision' => $this->decision?->value,
            'decision_note' => $this->decision_note,
            'decided_at' => $this->decided_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'order' => [
                'id' => $order->id,
                'status' => $order->status->value,
                'total' => (float) $order->total,
                'created_at' => $order->created_at?->toIso8601String(),
            ],
            'buyer' => [
                'name' => $order->buyer?->organization ?: $order->buyer?->user?->name,
                ...($isAdmin ? ['contact' => $order->buyer?->user?->only(['name', 'email', 'phone'])] : []),
            ],
            'supplier' => [
                'name' => $order->supplier?->company_name,
                ...($isAdmin ? ['contact' => $order->supplier?->user?->only(['name', 'email', 'phone'])] : []),
            ],
            'attachments' => $this->whenLoaded('attachments', fn () => $this->attachments->map(
                fn ($attachment) => $attachment->only(['id', 'original_name', 'mime', 'size'])
            )->values()),
            'assigned_admin' => $this->when($isAdmin, fn () => $this->assignedAdmin?->only(['id', 'name'])),
            'items' => $this->when($order->relationLoaded('items'), fn () => $order->items->map(
                fn ($item) => ['id' => $item->id, 'label' => $item->label, 'quantity' => (int) $item->quantity, 'unit_price' => (float) $item->unit_price]
            )->values()),
            'status_history' => $this->when($order->relationLoaded('statusHistory'), fn () => $order->statusHistory->map(
                fn ($step) => ['id' => $step->id, 'status' => $step->status?->value, 'changed_at' => $step->changed_at?->toIso8601String()]
            )->values()),
        ];
    }
}
