<?php

namespace App\Http\Controllers\Api\Supplier;

use App\Http\Controllers\Controller;
use App\Http\Requests\Supplier\IndexSupplierProductsRequest;
use App\Http\Requests\Supplier\ReorderProductImagesRequest;
use App\Http\Requests\Supplier\SaveProductRequest;
use App\Http\Requests\Supplier\StoreProductImagesRequest;
use App\Http\Resources\SupplierProductResource;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductImage;
use App\Services\ProductService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

/**
 * Produits du fournisseur connecté et validé
 * (SCRUM-33 : ajouter / modifier, photos ; SCRUM-34 : Mes produits, dépublier, supprimer).
 */
class SupplierProductController extends Controller
{
    public const PER_PAGE = 10;

    public function __construct(private readonly ProductService $products) {}

    /**
     * Mes produits (SCRUM-34) : 10 par page, filtres statut et catégorie (sous-catégories incluses),
     * nombre de vues, et compteurs par statut pour les onglets (indépendants du filtre de statut).
     */
    public function index(IndexSupplierProductsRequest $request): AnonymousResourceCollection
    {
        $supplier = $request->user()->supplierProfile;
        abort_if($supplier === null, 403, 'Profil fournisseur introuvable.');

        $base = Product::query()->where('supplier_id', $supplier->id);

        if ($request->filled('category_id')) {
            $categoryId = (int) $request->validated('category_id');
            $ids = Category::query()->whereKey($categoryId)->orWhere('parent_id', $categoryId)->pluck('id');
            $base->whereIn('category_id', $ids);
        }

        $counts = (clone $base)
            ->toBase()
            ->selectRaw('status, count(*) as aggregate')
            ->groupBy('status')
            ->pluck('aggregate', 'status');

        $products = (clone $base)
            ->when($request->filled('status'), fn ($query) => $query->where(
                'status',
                Product::statusFromApi($request->validated('status'))->value,
            ))
            ->with(['category:id,name,parent_id', 'mainImage'])
            ->withCount('views')
            ->latest()
            ->orderByDesc('id')
            ->paginate(self::PER_PAGE)
            ->withQueryString();

        $byStatus = collect(Product::API_STATUSES)
            ->map(fn ($status) => (int) $counts->get($status->value, 0));

        return SupplierProductResource::collection($products)->additional([
            'counts' => ['all' => $byStatus->sum(), ...$byStatus->all()],
        ]);
    }

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

    /**
     * Dépublier (SCRUM-34) : le produit repasse en brouillon et quitte le catalogue.
     */
    public function unpublish(Request $request, Product $product): JsonResponse
    {
        Gate::authorize('update', $product);

        $product = $this->products->unpublish($product);

        return response()->json([
            'message' => 'Produit dépublié : il n’apparaît plus dans le catalogue.',
            'product' => new SupplierProductResource($product->load(['category', 'images'])),
        ]);
    }

    /**
     * Mettre en avant (SCRUM-40) : { days: 7 | 14 | 30 }.
     */
    public function feature(Request $request, Product $product): JsonResponse
    {
        Gate::authorize('update', $product);

        $validated = $request->validate(
            ['days' => ['required', 'integer', Rule::in(ProductService::FEATURE_DURATIONS)]],
            ['days.required' => 'Choisissez une durée.', 'days.in' => 'Durée possible : 7, 14 ou 30 jours.'],
        );

        $product = $this->products->feature($product, (int) $validated['days']);

        return response()->json([
            'message' => 'Produit mis en avant jusqu’au '.$product->featured_until->timezone('Africa/Tunis')->format('d/m/Y').'.',
            'product' => new SupplierProductResource($product->load(['category', 'images'])),
        ]);
    }

    /**
     * Arrêter la mise en avant (SCRUM-40).
     */
    public function unfeature(Request $request, Product $product): JsonResponse
    {
        Gate::authorize('update', $product);

        $product = $this->products->unfeature($product);

        return response()->json([
            'message' => 'La mise en avant est arrêtée.',
            'product' => new SupplierProductResource($product->load(['category', 'images'])),
        ]);
    }

    /**
     * Supprimer (SCRUM-34) : définitif, sauf pour un produit déjà commandé (suppression douce).
     */
    public function destroy(Request $request, Product $product): JsonResponse
    {
        Gate::authorize('delete', $product);

        $title = $product->title;
        $permanent = $this->products->delete($product);

        return response()->json([
            'message' => $permanent
                ? "« {$title} » a été supprimé."
                : "« {$title} » a déjà été commandé : il est retiré du catalogue et de vos produits, mais conservé dans l'historique des commandes.",
            'permanent' => $permanent,
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
