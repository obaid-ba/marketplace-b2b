<?php

namespace App\Http\Resources;

use App\Contracts\MediaStorage;
use App\Models\SupplierProfile;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Carte « Fournisseur favori » (SCRUM-39, maquette B8) : uniquement des informations publiques.
 *
 * @mixin SupplierProfile
 */
class FavoriteSupplierResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'company_name' => $this->company_name,
            'logo_url' => app(MediaStorage::class)->url($this->logo),
            'region' => $this->region?->name,
            'rating_avg' => round((float) $this->rating_avg, 1),
            'reviews_count' => (int) $this->reviews_count,
            'categories' => $this->categories->pluck('name')->values(),
            'favorited_at' => $this->pivot?->created_at?->toIso8601String(),
        ];
    }
}
