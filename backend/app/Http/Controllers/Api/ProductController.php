<?php

namespace App\Http\Controllers\Api;

use App\Enums\ProductStatus;
use App\Enums\ValidationStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Catalog\SearchProductsRequest;
use App\Http\Resources\ProductCardResource;
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
     * Fiche produit détaillée avec données du fournisseur et suggestions du même fournisseur.
     */
    public function show(Request $request, Product $product, FavoriteService $favorites, ProductViewRecorder $views): JsonResponse
    {
        abort_unless(Product::query()->visible()->whereKey($product->id)->exists(), 404, 'Produit introuvable.');

        $product->load([
            'images',
            'category.parent',
            'supplier.region:id,name',
            'supplier:id,user_id,company_name,logo,delivery_days,payment_terms,validation_status,is_published,rating_avg,reviews_count',
        ]);

        $product->latest_reviews = Review::query()
            ->published()
            ->where('supplier_id', $product->supplier_id)
            ->with('buyer.user:id,name,first_name,last_name')
            ->latest()
            ->orderByDesc('id')
            ->limit(3)
            ->get();
        $product->is_favorite = $favorites->isFavorite($request->user('sanctum'), $product->supplier);

        $views->record($product, $request);

        // Produits additionnels du même fournisseur pour commande directe multi-articles sans panier
        $supplierProducts = Product::query()
            ->where('supplier_id', $product->supplier_id)
            ->where('id', '!=', $product->id)
            ->where('status', ProductStatus::PUBLISHED)
            ->select(['id', 'supplier_id', 'title', 'price', 'unit', 'stock'])
            ->limit(10)
            ->get();

        return response()->json([
            'product' => $product,
            'same_supplier_products' => $supplierProducts,
        ]);
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
