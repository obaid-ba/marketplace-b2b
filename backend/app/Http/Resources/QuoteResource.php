<?php

namespace App\Http\Resources;

use App\Enums\QuoteStatus;
use App\Enums\UserRole;
use App\Models\Quote;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Devis d'un fournisseur (SCRUM-46 / SCRUM-47 / F13-F14).
 *
 * @mixin Quote
 */
class QuoteResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $user = $request->user();
        $tender = $this->relationLoaded('tender') ? $this->tender : null;

        return [
            'id' => $this->id,
            'amount' => (float) $this->amount,
            'delivery_days' => (int) $this->delivery_days,
            'conditions' => $this->conditions,
            'comment' => $this->comment,
            'status' => $this->status?->value,
            'status_label' => $this->statusLabel(),
            'can_edit' => $this->canEdit($user, $tender),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
            'supplier' => $this->whenLoaded('supplier', fn () => $this->supplier ? [
                'id' => $this->supplier->id,
                'company_name' => $this->supplier->company_name,
                'rating_avg' => (float) $this->supplier->rating_avg,
                'reviews_count' => (int) $this->supplier->reviews_count,
                'delivery_days' => $this->supplier->delivery_days,
                'payment_terms' => $this->supplier->payment_terms,
                'professional_email' => $this->supplier->professional_email,
                'professional_phone' => $this->supplier->professional_phone,
                'region' => $this->supplier->relationLoaded('region') && $this->supplier->region
                    ? ['id' => $this->supplier->region->id, 'name' => $this->supplier->region->name]
                    : null,
            ] : null),
            'tender' => $tender ? [
                'id' => $tender->id,
                'title' => $tender->title,
                'description' => $tender->description,
                'status' => $tender->status?->value,
                'desired_deadline' => $tender->desired_deadline?->toDateString(),
                'category' => $tender->relationLoaded('category') && $tender->category ? [
                    'id' => $tender->category->id,
                    'name' => $tender->category->name,
                ] : null,
                'region' => $tender->relationLoaded('region') && $tender->region ? [
                    'id' => $tender->region->id,
                    'name' => $tender->region->name,
                ] : null,
            ] : null,
            'order_id' => $this->whenLoaded('order', fn () => $this->order?->id),
        ];
    }

    private function canEdit(?object $user, ?object $tender): bool
    {
        if (! $user || $user->role !== UserRole::Supplier || $this->status === QuoteStatus::ACCEPTED) {
            return false;
        }

        $supplierId = $user->supplierProfile?->id;

        if ($supplierId !== $this->supplier_id) {
            return false;
        }

        return $tender === null || $tender->isOpen();
    }

    private function statusLabel(): ?string
    {
        return match ($this->status) {
            QuoteStatus::SENT => 'Envoyé',
            QuoteStatus::IN_NEGOTIATION => 'En négociation',
            QuoteStatus::ACCEPTED => 'Accepté',
            QuoteStatus::REJECTED => 'Refusé',
            default => null,
        };
    }
}
