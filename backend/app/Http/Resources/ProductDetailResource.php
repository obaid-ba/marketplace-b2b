<?php

namespace App\Http\Resources;

use App\Contracts\MediaStorage;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Fiche produit publique (SCRUM-36) : photos ordonnées, catégorie et parent (fil d'Ariane),
 * fournisseur et sa note, 3 derniers avis du fournisseur.
 * Attend images, category.parent, supplier.region chargés ; latest_reviews et is_favorite fournis par le contrôleur.
 *
 * @mixin Product
 */
class ProductDetailResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $supplier = $this->supplier;
        $category = $this->category;

        return [
            'id' => $this->id,
            'title' => $this->title,
            'type' => $this->apiType(),
            'description' => $this->description,
            'price' => (float) $this->price,
            'unit' => $this->unit,
            'stock' => $this->isService() ? null : $this->stock,
            'in_stock' => $this->isService() || (int) $this->stock > 0,
            'availability_days' => $this->availability_days,
            'images' => $this->images->map(fn ($image) => ['id' => $image->id, 'url' => $image->url()])->values(),
            'category' => $category ? [
                'id' => $category->id,
                'name' => $category->name,
                'parent' => $category->parent ? ['id' => $category->parent->id, 'name' => $category->parent->name] : null,
            ] : null,
            'supplier' => [
                'id' => $supplier->id,
                'company_name' => $supplier->company_name,
                'logo_url' => app(MediaStorage::class)->url($supplier->logo),
                'region' => $supplier->region?->name,
                'rating_avg' => round((float) $supplier->rating_avg, 1),
                'reviews_count' => (int) $supplier->reviews_count,
                'is_favorite' => (bool) ($this->is_favorite ?? false),
            ],
            'latest_reviews' => ReviewResource::collection($this->latest_reviews ?? collect()),
        ];
    }
}
