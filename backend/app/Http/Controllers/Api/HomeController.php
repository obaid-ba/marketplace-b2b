<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\HomeService;
use Illuminate\Http\JsonResponse;

/**
 * Page d'accueil (SCRUM-38) : chiffres clés, 8 catégories principales, 4 produits mis en avant.
 */
class HomeController extends Controller
{
    public function __invoke(HomeService $home): JsonResponse
    {
        return response()->json($home->data());
    }
}
