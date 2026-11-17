<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Catalog\SearchProductsRequest;
use App\Http\Resources\ProductCardResource;
use App\Http\Resources\ProductDetailResource;
use App\Models\Product;
use App\Models\Review;
use App\Services\FavoriteService;
use App\Services\ProductCatalogService;
use App\Services\ProductViewRecorder;
use Illuminate\Http\Request;
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

    /**
     * Fiche produit (SCRUM-36). 404 « Produit introuvable » si le produit n'est pas visible.
     * La consultation est enregistrée après l'envoi de la réponse (ProductViewRecorder).
     */
    public function show(Request $request, int $product, FavoriteService $favorites, ProductViewRecorder $views): ProductDetailResource
    {
        $model = Product::query()
            ->visible()
            ->with(['images', 'category.parent', 'supplier.region:id,name'])
            ->findOr($product, fn () => abort(404, 'Produit introuvable.'));

        $model->latest_reviews = Review::query()
            ->published()
            ->where('supplier_id', $model->supplier_id)
            ->with('buyer.user:id,name,first_name,last_name')
            ->latest()
            ->orderByDesc('id')
            ->limit(3)
            ->get();
        $model->is_favorite = $favorites->isFavorite($request->user('sanctum'), $model->supplier);

        $views->record($model, $request);

        return new ProductDetailResource($model);
    }
}
