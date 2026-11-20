<?php

namespace App\Http\Resources;

use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Nœud de l'arborescence des catégories (SCRUM-32).
 * products_count / tenders_count ne sont présents que s'ils ont été calculés (CategoryService::tree).
 *
 * @mixin Category
 */
class CategoryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'parent_id' => $this->parent_id,
            'position' => $this->position,
            'products_count' => $this->when(isset($this->products_count), fn () => $this->products_count),
            'tenders_count' => $this->when(isset($this->tenders_count), fn () => $this->tenders_count),
            'children' => CategoryResource::collection($this->whenLoaded('children')),
        ];
    }
}
