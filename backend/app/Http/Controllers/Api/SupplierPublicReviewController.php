<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Review;
use App\Models\SupplierProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Consultation publique des avis d'un fournisseur (SCRUM-65 / F20).
 */
class SupplierPublicReviewController extends Controller
{
    /**
     * Liste paginée des avis publiés d'un fournisseur donné (accessible publiquement).
     */
    public function index(Request $request, SupplierProfile $supplier): JsonResponse
    {
        abort_unless(SupplierProfile::query()->visibleInCatalog()->whereKey($supplier->id)->exists(), 404, 'Fournisseur introuvable.');

        $perPage = max(1, min(50, (int) $request->query('per_page', 10)));

        $reviews = Review::query()
            ->where('supplier_id', $supplier->id)
            ->published()
            ->with([
                'buyer.user:id,name',
                'buyer:id,user_id,organization',
                'order:id,created_at,total',
            ])
            ->orderByDesc('created_at')
            ->paginate($perPage);

        return response()->json([
            'rating_avg' => (float) $supplier->rating_avg,
            'reviews_count' => (int) $supplier->reviews_count,
            'reviews' => $reviews,
        ]);
    }
}
