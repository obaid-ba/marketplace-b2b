<?php

namespace App\Http\Resources;

use App\Models\Review;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Avis public (SCRUM-37 / SCRUM-36) : auteur abrégé (« Sana B. »), note, commentaire, réponse du fournisseur.
 * Attend buyer.user chargé.
 *
 * @mixin Review
 */
class ReviewResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'author' => $this->authorDisplayName(),
            'rating' => $this->rating,
            'comment' => $this->comment,
            'supplier_reply' => $this->supplier_reply,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
