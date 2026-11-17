<?php

namespace App\Http\Resources;

use App\Contracts\MediaStorage;
use App\Models\SupplierProfile;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Fiche publique d'un fournisseur (SCRUM-37). Jamais de documents, de coordonnées privées,
 * d'identifiant fiscal ni d'informations de validation.
 * Attend region, categories et coverageRegions chargés ; products_count et is_favorite fournis par le contrôleur.
 *
 * @mixin SupplierProfile
 */
class SupplierPublicResource extends JsonResource
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
            'description' => $this->description,
            'sector' => $this->sector,
            'region' => $this->region?->name,
            'categories' => $this->categories
                ->map(fn ($category) => ['id' => $category->id, 'name' => $category->name])
                ->values(),
            'coverage_regions' => $this->coverageRegions->pluck('name')->values(),
            'is_validated' => true, // seuls les fournisseurs validés ont une fiche publique
            'rating_avg' => round((float) $this->rating_avg, 1),
            'reviews_count' => (int) $this->reviews_count,
            'products_count' => (int) ($this->visible_products_count ?? 0),
            'is_favorite' => (bool) ($this->is_favorite ?? false),
            // Résumé IA points forts / faibles (S6) : null tant qu'il n'est pas généré, l'encadré est alors masqué.
            'ai_summary' => null,
        ];
    }
}
