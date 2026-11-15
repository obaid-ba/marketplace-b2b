<?php

namespace App\Http\Resources;

use App\Enums\ValidationStatus;
use App\Models\SupplierProfile;
use App\Services\SupplierProfileService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/**
 * Profil de l'entreprise vu par son propriétaire (SCRUM-28).
 *
 * @mixin SupplierProfile
 */
class SupplierProfileResource extends JsonResource
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
            'region_id' => $this->region_id,
            'region' => $this->whenLoaded('region', fn () => $this->region ? [
                'id' => $this->region->id,
                'name' => $this->region->name,
            ] : null),
            'professional_phone' => $this->professional_phone,
            'professional_email' => $this->professional_email,
            'categories' => $this->whenLoaded('categories', fn () => $this->categories
                ->map(fn ($category) => [
                    'id' => $category->id,
                    'parent_id' => $category->parent_id,
                    'name' => $category->name,
                ])->values()),
            'coverage_regions' => $this->whenLoaded('coverageRegions', fn () => $this->coverageRegions
                ->map(fn ($region) => ['id' => $region->id, 'name' => $region->name])->values()),
            'validation_status' => $this->validation_status->value,
            'rejection_reason' => $this->rejection_reason,
            'is_published' => (bool) $this->is_published,
            'can_publish' => $this->validation_status === ValidationStatus::VALIDATED,
            // Réputation : lecture seule, calculée à partir des avis (EP07).
            'rating_avg' => round((float) $this->rating_avg, 1),
            'reviews_count' => (int) $this->reviews_count,
            'documents' => SupplierDocumentResource::collection($this->whenLoaded('documents')),
        ];
    }
}
