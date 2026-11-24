<?php

namespace App\Http\Controllers\Api\Buyer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\PeriodRangeRequest;
use App\Services\Dashboard\BuyerDashboardService;
use Illuminate\Http\JsonResponse;

/**
 * Tableau de bord porteur de projet (SCRUM-121 / F27, story SCRUM-69).
 * Accessible uniquement au rôle `buyer` (middleware du groupe de routes).
 */
class BuyerDashboardController extends Controller
{
    public function __construct(private readonly BuyerDashboardService $dashboard) {}

    public function index(PeriodRangeRequest $request): JsonResponse
    {
        $buyer = $request->user()->buyerProfile;

        if (! $buyer) {
            return response()->json(['message' => 'Profil acheteur introuvable.'], 403);
        }

        [$from, $to] = $request->range();

        return response()->json($this->dashboard->build($buyer, $from, $to));
    }
}
