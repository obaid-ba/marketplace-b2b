<?php

namespace App\Http\Resources;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Produit vu par son fournisseur (SCRUM-33 / SCRUM-34) : tous les champs du formulaire,
 * statut, motif de retrait, photos dans l'ordre, nombre de vues.
 *
 * @mixin Product
 */
class SupplierProductResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->apiType(),
            'title' => $this->title,
            'description' => $this->description,
            'price' => (float) $this->price,
            'unit' => $this->unit,
            'stock' => $this->stock,
            'availability_days' => $this->availability_days,
            'status' => $this->apiStatus(),
            'withdrawal_reason' => $this->isWithdrawn() ? $this->withdrawal_reason : null,
            'featured_until' => $this->featured_until?->toIso8601String(),
            'category_id' => $this->category_id,
            'category' => $this->whenLoaded('category', fn () => $this->category ? [
                'id' => $this->category->id,
                'name' => $this->category->name,
                'parent_id' => $this->category->parent_id,
            ] : null),
            'images' => $this->whenLoaded('images', fn () => $this->images->map(fn ($image) => [
                'id' => $image->id,
                'url' => $image->url(),
                'position' => $image->position,
            ])->values()),
            'main_image_url' => $this->whenLoaded('mainImage', fn () => $this->mainImage?->url()),
            'views_count' => $this->when(isset($this->views_count), fn () => (int) $this->views_count),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
