<?php

namespace App\Services;

use App\Http\Resources\CategoryResource;
use App\Http\Resources\ProductCardResource;
use App\Models\Product;
use App\Models\SupplierProfile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Données de la page d'accueil (SCRUM-38), mises en cache 10 minutes.
 * Tous les compteurs reposent sur les mêmes règles de visibilité que le catalogue.
 */
class HomeService
{
    public const CACHE_KEY = 'home:v1';

    public const CACHE_SECONDS = 600;

    public const CATEGORIES = 8;

    public const FEATURED = 4;

    public function __construct(private readonly CategoryService $categories) {}

    /**
     * @return array{stats: array<string, int>, categories: mixed, featured_products: mixed}
     */
    public function data(): array
    {
        return Cache::remember(self::CACHE_KEY, self::CACHE_SECONDS, fn () => $this->build());
    }

    public function forget(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    /**
     * @return array{stats: array<string, int>, categories: mixed, featured_products: mixed}
     */
    private function build(): array
    {
        $request = request();

        return [
            'stats' => $this->stats(),
            'categories' => CategoryResource::collection(
                $this->categories->tree(publicCounts: true)->take(self::CATEGORIES)->each->unsetRelation('children'),
            )->resolve($request),
            'featured_products' => ProductCardResource::collection($this->featured())->resolve($request),
        ];
    }

    /**
     * @return array{suppliers: int, products: int, regions: int}
     */
    private function stats(): array
    {
        $visibleSuppliers = SupplierProfile::query()->visibleInCatalog()->select('id');

        // Gouvernorats couverts : siège ou zone de couverture d'au moins un fournisseur visible.
        $regions = DB::table('supplier_coverage_region')
            ->whereIn('supplier_id', $visibleSuppliers)
            ->select('region_id')
            ->union(
                SupplierProfile::query()->visibleInCatalog()->whereNotNull('region_id')->select('region_id')->toBase(),
            )
            ->get()
            ->pluck('region_id')
            ->unique()
            ->count();

        return [
            'suppliers' => SupplierProfile::query()->visibleInCatalog()->count(),
            'products' => Product::query()->visible()->count(),
            'regions' => $regions,
        ];
    }

    /**
     * Produits mis en avant (featured_until dans le futur), complétés si besoin par les produits
     * des fournisseurs les mieux notés.
     *
     * @return Collection<int, Product>
     */
    private function featured()
    {
        $base = fn () => Product::query()
            ->visible()
            ->select(ProductCatalogService::CARD_COLUMNS)
            ->with(ProductCatalogService::cardRelations());

        $featured = $base()
            ->where('products.featured_until', '>', now())
            ->orderByDesc('products.featured_until')
            ->orderByDesc('products.id')
            ->limit(self::FEATURED)
            ->get();

        if ($featured->count() < self::FEATURED) {
            $featured = $featured->concat(
                $base()
                    ->whereNotIn('products.id', $featured->pluck('id'))
                    ->orderByDesc(
                        SupplierProfile::query()->select('rating_avg')->whereColumn('supplier_profiles.id', 'products.supplier_id')
                    )
                    ->orderByDesc('products.created_at')
                    ->orderByDesc('products.id')
                    ->limit(self::FEATURED - $featured->count())
                    ->get(),
            );
        }

        return $featured->values();
    }
}
