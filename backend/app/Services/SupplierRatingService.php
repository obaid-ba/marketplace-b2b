<?php

namespace App\Services;

use App\Models\Review;
use App\Models\SupplierProfile;

/**
 * Recalcul de la note moyenne d'un fournisseur (SCRUM-72 / F29).
 *
 * Seuls les avis publiés comptent : masquer un avis le retire immédiatement
 * de la moyenne affichée dans le catalogue.
 */
class SupplierRatingService
{
    public function recompute(int $supplierId): void
    {
        $stats = Review::query()
            ->where('supplier_id', $supplierId)
            ->published()
            ->selectRaw('AVG(rating) as avg_rating, COUNT(*) as total_count')
            ->first();

        SupplierProfile::query()
            ->whereKey($supplierId)
            ->update([
                'rating_avg' => $stats?->avg_rating !== null ? round((float) $stats->avg_rating, 2) : 0,
                'reviews_count' => (int) ($stats->total_count ?? 0),
            ]);
    }
}
