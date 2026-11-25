<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ReviewResource;
use App\Http\Resources\SupplierPublicResource;
use App\Models\Category;
use App\Models\Product;
use App\Models\Review;
use App\Models\SupplierProfile;
use App\Services\FavoriteService;
use App\Services\SupplierProfileService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Fiche publique d'un fournisseur (SCRUM-37) : accessible sans connexion.
 * 404 si le fournisseur n'est pas visible (non validé, suspendu, désactivé, supprimé ou profil non publié).
 */
class SupplierController extends Controller
{
    public const REVIEWS_PER_PAGE = 10;

    public const DIRECTORY_PER_PAGE = 12;

    /**
     * Annuaire public des fournisseurs : uniquement les fournisseurs visibles (validés, publiés, actifs).
     * Filtres : q (nom, secteur, description), region_id (siège ou zone couverte), category_id (et ses sous-catégories).
     * Tri : rating (défaut), name, products.
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'region_id' => ['nullable', 'integer'],
            'category_id' => ['nullable', 'integer'],
            'sort' => ['nullable', 'in:rating,name,products'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $visibleProducts = fn ($query) => $query->visible();

        $query = SupplierProfile::query()
            ->visibleInCatalog()
            ->with(['region:id,name', 'categories:id,name'])
            ->withCount(['products as visible_products_count' => $visibleProducts])
            ->when($filters['q'] ?? null, function ($query, string $search) {
                $like = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $search).'%';
                $query->where(fn ($inner) => $inner
                    ->whereRaw("company_name LIKE ? ESCAPE '!'", [$like])
                    ->orWhereRaw("sector LIKE ? ESCAPE '!'", [$like])
                    ->orWhereRaw("description LIKE ? ESCAPE '!'", [$like]));
            })
            ->when($filters['region_id'] ?? null, fn ($query, int $region) => $query->where(fn ($inner) => $inner
                ->where('region_id', $region)
                ->orWhereHas('coverageRegions', fn ($covered) => $covered->where('regions.id', $region))))
            ->when($filters['category_id'] ?? null, function ($query, int $category) {
                $family = Category::query()->whereKey($category)->orWhere('parent_id', $category)->pluck('id');
                $query->whereHas('categories', fn ($categories) => $categories->whereIn('categories.id', $family));
            });

        match ($filters['sort'] ?? 'rating') {
            'name' => $query->orderBy('company_name'),
            'products' => $query->orderByDesc('visible_products_count')->orderBy('company_name'),
            default => $query->orderByDesc('rating_avg')->orderByDesc('reviews_count')->orderBy('company_name'),
        };

        $page = $query->paginate(self::DIRECTORY_PER_PAGE)->withQueryString();

        return response()->json([
            'data' => $page->getCollection()->map(fn (SupplierProfile $supplier) => [
                'id' => $supplier->id,
                'company_name' => $supplier->company_name,
                'logo_url' => $supplier->logo ? Storage::disk(SupplierProfileService::LOGO_DISK)->url($supplier->logo) : null,
                'sector' => $supplier->sector,
                'description' => Str::limit((string) $supplier->description, 140),
                'region' => $supplier->region?->name,
                'categories' => $supplier->categories->pluck('name')->take(3)->values(),
                'rating_avg' => round((float) $supplier->rating_avg, 1),
                'reviews_count' => (int) $supplier->reviews_count,
                'products_count' => (int) $supplier->visible_products_count,
            ])->values(),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'total' => $page->total(),
                'from' => $page->firstItem(),
                'to' => $page->lastItem(),
            ],
        ]);
    }

    public function show(Request $request, int $supplier, FavoriteService $favorites): SupplierPublicResource
    {
        $profile = $this->visibleOrFail($supplier);
        $profile->load(['region:id,name', 'categories:id,name', 'coverageRegions:id,name']);

        $profile->visible_products_count = Product::query()->visible()->where('products.supplier_id', $profile->id)->count();
        $profile->is_favorite = $favorites->isFavorite($request->user('sanctum'), $profile);

        return new SupplierPublicResource($profile);
    }

    /**
     * Avis publiés, du plus récent au plus ancien, avec la réponse du fournisseur.
     */
    public function reviews(int $supplier): AnonymousResourceCollection
    {
        $profile = $this->visibleOrFail($supplier);

        $reviews = Review::query()
            ->published()
            ->where('supplier_id', $profile->id)
            ->with('buyer.user:id,name,first_name,last_name')
            ->latest()
            ->orderByDesc('id')
            ->paginate(self::REVIEWS_PER_PAGE);

        return ReviewResource::collection($reviews);
    }

    private function visibleOrFail(int $id): SupplierProfile
    {
        return SupplierProfile::query()->visibleInCatalog()->findOr($id, fn () => abort(404, 'Fournisseur introuvable.'));
    }
}
