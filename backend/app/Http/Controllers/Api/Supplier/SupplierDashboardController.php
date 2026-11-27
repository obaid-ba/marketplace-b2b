<?php

namespace App\Http\Controllers\Api\Supplier;

use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\PeriodRangeRequest;
use App\Services\Dashboard\SupplierDashboardService;
use Illuminate\Http\JsonResponse;

/**
 * Tableau de bord fournisseur (SCRUM-120 / F26, story SCRUM-68).
 *
 * Accessible dès que le compte a un profil fournisseur : un fournisseur en
 * attente de validation voit un tableau de bord vide plutôt qu'une erreur.
 */
class SupplierDashboardController extends Controller
{
    public function __construct(private readonly SupplierDashboardService $dashboard) {}

    public function index(PeriodRangeRequest $request): JsonResponse
    {
        $supplier = $request->user()->supplierProfile;

        if (! $supplier) {
            return response()->json(['message' => 'Profil fournisseur introuvable.'], 403);
        }

        [$from, $to] = $request->range();

        return response()->json($this->dashboard->build($supplier, $from, $to));
    }
}
