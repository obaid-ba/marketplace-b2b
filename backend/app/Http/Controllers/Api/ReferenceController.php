<?php

namespace App\Http\Controllers\Api;

use App\Enums\SupplierSector;
use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Region;
use Illuminate\Http\JsonResponse;

/**
 * Données de référence utilisées par les formulaires (régions, catégories).
 */
class ReferenceController extends Controller
{
    public function regions(): JsonResponse
    {
        return response()->json(
            Region::query()->orderBy('name')->get(['id', 'name'])
        );
    }

    public function categories(): JsonResponse
    {
        return response()->json(
            Category::query()
                ->orderBy('position')
                ->orderBy('name')
                ->get(['id', 'parent_id', 'name', 'position'])
        );
    }

    /**
     * Secteurs d'activité de la liste déroulante du profil fournisseur (SCRUM-28).
     */
    public function sectors(): JsonResponse
    {
        return response()->json(SupplierSector::values());
    }
}
