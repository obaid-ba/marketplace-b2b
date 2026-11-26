<?php

namespace App\Http\Controllers\Api;

use App\Enums\ProductStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Catalog\SearchProductsRequest;
use App\Http\Resources\ProductCardResource;
use App\Http\Resources\ProductDetailResource;
use App\Models\Product;
use App\Models\Review;
use App\Models\SupplierProfile;
use App\Services\FavoriteService;
use App\Services\ProductCatalogService;
use App\Services\ProductViewRecorder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Consultation publique des fiches produits et catalogue fournisseur (SCRUM-51).
 */
class ProductController extends Controller
{
    /**
     * Recherche, filtres, tri et pagination du catalogue public.
     */
    public function index(SearchProductsRequest $request, ProductCatalogService $catalog): AnonymousResourceCollection
    {
        return ProductCardResource::collection($catalog->search($request->validated()));
    }

    /**
     * Fiche produit (SCRUM-36) et autres produits du même fournisseur pour la commande directe (SCRUM-51).
     * 404 « Produit introuvable » si le produit n'est pas visible. La consultation est enregistrée après la réponse.
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
        $model->same_supplier_products = Product::query()
            ->visible()
            ->where('supplier_id', $model->supplier_id)
            ->whereKeyNot($model->id)
            ->limit(10)
            ->get(['id', 'supplier_id', 'title', 'price', 'unit', 'stock']);

        $views->record($model, $request);

        return new ProductDetailResource($model);
    }

    /**
     * Produits publiés d'un fournisseur spécifique.
     */
    public function bySupplier(SupplierProfile $supplier): JsonResponse
    {
        $products = Product::query()
            ->visible()
            ->where('supplier_id', $supplier->id)
            ->where('status', ProductStatus::PUBLISHED)
            ->select(['id', 'supplier_id', 'category_id', 'title', 'description', 'price', 'unit', 'stock'])
            ->get();

        return response()->json([
            'supplier' => [
                'id' => $supplier->id,
                'company_name' => $supplier->company_name,
                'logo' => $supplier->logo,
                'delivery_days' => $supplier->delivery_days,
                'payment_terms' => $supplier->payment_terms,
            ],
            'products' => $products,
        ]);
    }
}
