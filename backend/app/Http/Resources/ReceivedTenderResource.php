<?php

namespace App\Http\Resources;

use App\Models\TenderRecipient;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Demande reçue par un fournisseur, avec score de pertinence et devis éventuel (SCRUM-44).
 *
 * @mixin TenderRecipient
 */
class ReceivedTenderResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $tender = $this->tender;
        $quote = $tender?->relationLoaded('quotes') ? $tender->quotes->first() : null;

        return [
            'recipient_id' => $this->id,
            'score' => $this->score !== null ? (float) $this->score : null,
            'source' => $this->source,
            'notified_at' => $this->notified_at?->toIso8601String(),
            'seen_at' => $this->seen_at?->toIso8601String(),
            'already_responded' => $quote !== null,
            'my_quote' => $quote ? new QuoteResource($quote) : null,
            'tender' => $tender ? [
                'id' => $tender->id,
                'title' => $tender->title,
                'description' => $tender->description,
                'status' => $tender->status?->value,
                'status_label' => $tender->statusLabel(),
                'budget' => $tender->budget !== null ? (float) $tender->budget : null,
                'desired_deadline' => $tender->desired_deadline?->toDateString(),
                'created_at' => $tender->created_at?->toIso8601String(),
                'category' => $tender->relationLoaded('category') && $tender->category ? [
                    'id' => $tender->category->id,
                    'name' => $tender->category->name,
                ] : null,
                'region' => $tender->relationLoaded('region') && $tender->region ? [
                    'id' => $tender->region->id,
                    'name' => $tender->region->name,
                ] : null,
                'attachments' => $tender->relationLoaded('attachments') ? $tender->attachments->map(fn ($attachment) => [
                    'id' => $attachment->id,
                    'name' => $attachment->original_name ?? basename($attachment->file_path),
                ])->values() : [],
                'buyer' => $tender->relationLoaded('buyer') && $tender->buyer ? [
                    'organization' => $tender->buyer->organization,
                    'name' => $tender->buyer->user?->name,
                ] : null,
            ] : null,
        ];
    }
}
