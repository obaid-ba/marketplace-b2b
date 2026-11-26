<?php

namespace App\Http\Controllers\Api\Buyer;

use App\Http\Controllers\Controller;
use App\Services\SupplierProfileService;
use App\Services\SupplierRecommendationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Fournisseurs recommandés selon les achats passés (SCRUM-87), affichés sur le tableau de bord porteur.
 */
class RecommendationController extends Controller
{
    public function index(Request $request, SupplierRecommendationService $recommendations): JsonResponse
    {
        $buyer = $request->user()->buyerProfile()->firstOrFail();

        return response()->json([
            'data' => $recommendations->forBuyer($buyer)->map(fn (array $item) => [
                'id' => $item['supplier']->id,
                'company_name' => $item['supplier']->company_name,
                'logo_url' => $item['supplier']->logo
                    ? Storage::disk(SupplierProfileService::LOGO_DISK)->url($item['supplier']->logo)
                    : null,
                'region' => $item['supplier']->region?->name,
                'rating_avg' => round((float) $item['supplier']->rating_avg, 1),
                'reviews_count' => (int) $item['supplier']->reviews_count,
                'categories' => $item['supplier']->categories->pluck('name')->take(3)->values(),
                'reason' => $item['reason'],
            ])->values(),
        ]);
    }
}
