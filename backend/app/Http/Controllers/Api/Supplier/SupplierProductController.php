<?php

namespace App\Http\Controllers\Api\Supplier;

use App\Http\Controllers\Controller;
use App\Http\Requests\Supplier\ReorderProductImagesRequest;
use App\Http\Requests\Supplier\SaveProductRequest;
use App\Http\Requests\Supplier\StoreProductImagesRequest;
use App\Http\Resources\SupplierProductResource;
use App\Models\Product;
use App\Models\ProductImage;
use App\Services\ProductService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Produits du fournisseur connecté et validé (SCRUM-33 : ajouter / modifier, photos).
 */
class SupplierProductController extends Controller
{
    public function __construct(private readonly ProductService $products) {}

    public function store(SaveProductRequest $request): JsonResponse
    {
        $supplier = $request->user()->supplierProfile;
        abort_if($supplier === null, 403, 'Profil fournisseur introuvable.');

        $product = $this->products->create($supplier, $request->validated());

        return response()->json([
            'message' => 'Produit enregistré en brouillon.',
            'product' => new SupplierProductResource($product->load(['category', 'images'])),
        ], 201);
    }

    public function show(Request $request, Product $product): SupplierProductResource
    {
        Gate::authorize('view', $product);

        return new SupplierProductResource($product->load(['category', 'images']));
    }

    public function update(SaveProductRequest $request, Product $product): JsonResponse
    {
        Gate::authorize('update', $product);

        $product = $this->products->update($product, $request->validated());

        return response()->json([
            'message' => match ($product->apiStatus()) {
                'published' => 'Produit publié : il est visible dans le catalogue.',
                'withdrawn' => 'Modifications enregistrées. Le produit reste retiré du catalogue.',
                default => 'Brouillon enregistré.',
            },
            'product' => new SupplierProductResource($product->load(['category', 'images'])),
        ]);
    }

    public function storeImages(StoreProductImagesRequest $request, Product $product): JsonResponse
    {
        Gate::authorize('update', $product);

        $product = $this->products->addImages($product, $request->file('images'));

        return response()->json([
            'message' => 'Photos ajoutées.',
            'product' => new SupplierProductResource($product->load('category')),
        ], 201);
    }

    public function reorderImages(ReorderProductImagesRequest $request, Product $product): JsonResponse
    {
        Gate::authorize('update', $product);

        $product = $this->products->reorderImages($product, $request->validated('image_ids'));

        return response()->json([
            'message' => 'Ordre des photos enregistré.',
            'product' => new SupplierProductResource($product->load('category')),
        ]);
    }

    public function destroyImage(Request $request, Product $product, ProductImage $image): JsonResponse
    {
        Gate::authorize('update', $product);
        abort_unless($image->product_id === $product->id, 404);

        $product = $this->products->deleteImage($product, $image);

        return response()->json([
            'message' => 'Photo supprimée.',
            'product' => new SupplierProductResource($product->load('category')),
        ]);
    }
}
