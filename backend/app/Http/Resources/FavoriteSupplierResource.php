<?php

namespace App\Http\Resources;

use App\Models\SupplierProfile;
use App\Services\SupplierProfileService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

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
            'logo_url' => $this->logo ? Storage::disk(SupplierProfileService::LOGO_DISK)->url($this->logo) : null,
            'region' => $this->region?->name,
            'rating_avg' => round((float) $this->rating_avg, 1),
            'reviews_count' => (int) $this->reviews_count,
            'categories' => $this->categories->pluck('name')->values(),
            'favorited_at' => $this->pivot?->created_at?->toIso8601String(),
        ];
    }
}
