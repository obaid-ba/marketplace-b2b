<?php

namespace App\Http\Resources;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Carte produit du catalogue public (SCRUM-35), réutilisée par la fiche produit (similaires),
 * la fiche fournisseur et la page d'accueil. Attend mainImage, supplier et supplier.region chargés.
 *
 * @mixin Product
 */
class ProductCardResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'type' => $this->apiType(),
            'price' => (float) $this->price,
            'unit' => $this->unit,
            'main_image_url' => $this->mainImage?->url(),
            // Mis en avant (SCRUM-40) : la carte affiche un badge pendant la période.
            'featured' => $this->featured_until?->isFuture() === true,
            'supplier' => [
                'id' => $this->supplier->id,
                'company_name' => $this->supplier->company_name,
                'region' => $this->supplier->region?->name,
                'rating_avg' => round((float) $this->supplier->rating_avg, 1),
            ],
        ];
    }
}
