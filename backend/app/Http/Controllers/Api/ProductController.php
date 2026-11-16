<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Catalog\SearchProductsRequest;
use App\Http\Resources\ProductCardResource;
use App\Services\ProductCatalogService;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Catalogue public : accessible sans connexion.
 */
class ProductController extends Controller
{
    /**
     * Recherche, filtres, tri et pagination (SCRUM-35).
     * Réponse paginée : { data: [ProductCard], links, meta: { current_page, last_page, total, … } }.
     */
    public function index(SearchProductsRequest $request, ProductCatalogService $catalog): AnonymousResourceCollection
    {
        return ProductCardResource::collection($catalog->search($request->validated()));
    }
}
