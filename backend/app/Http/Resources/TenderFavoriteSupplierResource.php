<?php

namespace App\Http\Resources;

use App\Models\SupplierProfile;
use App\Services\SupplierProfileService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/**
 * Fournisseur favori proposé à l'invitation sur une demande (SCRUM-49).
 *
 * @mixin SupplierProfile
 */
class TenderFavoriteSupplierResource extends JsonResource
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
            'description' => $this->description,
            'sector' => $this->sector,
            'rating_avg' => (float) $this->rating_avg,
            'reviews_count' => (int) $this->reviews_count,
            'delivery_days' => $this->delivery_days,
            'payment_terms' => $this->payment_terms,
            'region' => $this->whenLoaded('region', fn () => $this->region ? [
                'id' => $this->region->id,
                'name' => $this->region->name,
            ] : null),
            'categories' => $this->whenLoaded('categories', fn () => $this->categories->map(fn ($category) => [
                'id' => $category->id,
                'name' => $category->name,
            ])->values()),
            'invited' => (bool) ($this->invited ?? false),
            'responded' => (bool) ($this->responded ?? false),
        ];
    }
}
