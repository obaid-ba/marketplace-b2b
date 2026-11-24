<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\PeriodRangeRequest;
use App\Services\Dashboard\AdminDashboardService;
use Illuminate\Http\JsonResponse;

/**
 * Tableau de bord administrateur (SCRUM-122 / F28, story SCRUM-70).
 * Accessible uniquement au rôle `admin` (middleware du groupe de routes).
 */
class AdminDashboardController extends Controller
{
    public function __construct(private readonly AdminDashboardService $dashboard) {}

    public function index(PeriodRangeRequest $request): JsonResponse
    {
        [$from, $to] = $request->range();

        return response()->json($this->dashboard->build($from, $to));
    }
}
