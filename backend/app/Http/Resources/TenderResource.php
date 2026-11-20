<?php

namespace App\Http\Resources;

use App\Models\Tender;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Demande vue par le porteur de projet (SCRUM-43 / F11).
 *
 * @mixin Tender
 */
class TenderResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'description' => $this->description,
            'status' => $this->status?->value,
            'status_label' => $this->statusLabel(),
            'budget' => $this->budget !== null ? (float) $this->budget : null,
            'desired_deadline' => $this->desired_deadline?->toDateString(),
            'created_at' => $this->created_at?->toIso8601String(),
            'category' => $this->whenLoaded('category', fn () => $this->category ? [
                'id' => $this->category->id,
                'name' => $this->category->name,
            ] : null),
            'region' => $this->whenLoaded('region', fn () => $this->region ? [
                'id' => $this->region->id,
                'name' => $this->region->name,
            ] : null),
            'attachments' => $this->whenLoaded('attachments', fn () => $this->attachments->map(fn ($attachment) => [
                'id' => $attachment->id,
                'name' => $attachment->original_name ?? basename($attachment->file_path),
            ])->values()),
            'quotes_count' => $this->whenCounted('quotes'),
            'recipients_count' => $this->whenCounted('recipients'),
            'notified_count' => $this->whenCounted('notified_count'),
            'buyer' => $this->whenLoaded('buyer', fn () => $this->buyer ? [
                'id' => $this->buyer->id,
                'organization' => $this->buyer->organization,
                'name' => $this->buyer->user?->name,
            ] : null),
        ];
    }
}
