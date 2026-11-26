<?php

namespace App\Services;

use App\Http\Requests\Catalog\SearchProductsRequest;
use App\Models\Category;
use App\Models\Product;
use App\Models\SupplierProfile;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

/**
 * Recherche dans le catalogue public (SCRUM-35). Toujours limitée aux produits visibles.
 * Une page = 3 requêtes quel que soit le nombre de résultats (compte, produits, images ; fournisseurs
 * et régions en eager loading), pour rester sous la seconde.
 */
class ProductCatalogService
{
    /** Colonnes utiles à une carte produit. */
    public const CARD_COLUMNS = ['products.id', 'products.supplier_id', 'products.category_id', 'products.type', 'products.title', 'products.price', 'products.unit', 'products.created_at', 'products.featured_until'];

    /**
     * Relations d'une carte produit (ProductCardResource).
     *
     * @return array<int|string, mixed>
     */
    public static function cardRelations(): array
    {
        return [
            'mainImage',
            'supplier:id,company_name,region_id,rating_avg',
            'supplier.region:id,name',
        ];
    }

    /**
     * @param  array<string, mixed>  $filters  données validées par SearchProductsRequest
     */
    public function search(array $filters): LengthAwarePaginator
    {
        $query = Product::query()
            ->visible()
            ->select(self::CARD_COLUMNS)
            ->with(self::cardRelations());

        $this->applyFilters($query, $filters);
        $this->applySort($query, $filters['sort'] ?? null, filled($filters['q'] ?? null) ? $filters['q'] : null);

        return $query
            ->paginate((int) ($filters['per_page'] ?? SearchProductsRequest::DEFAULT_PER_PAGE))
            ->withQueryString();
    }

    /**
     * @param  Builder<Product>  $query
     * @param  array<string, mixed>  $filters
     */
    private function applyFilters(Builder $query, array $filters): void
    {
        if (filled($filters['q'] ?? null)) {
            // LOWER() des deux côtés : MySQL/SQLite comparent « LIKE » sans tenir compte de la casse, PostgreSQL non.
            $like = mb_strtolower('%'.$this->escapeLike($filters['q']).'%');
            $query->where(fn (Builder $q) => $q
                ->whereRaw("LOWER(products.title) LIKE ? ESCAPE '!'", [$like])
                ->orWhereRaw("LOWER(products.description) LIKE ? ESCAPE '!'", [$like]));
        }

        if (! empty($filters['category'])) {
            // Une catégorie principale inclut ses sous-catégories.
            $ids = Category::query()
                ->whereIn('id', $filters['category'])
                ->orWhereIn('parent_id', $filters['category'])
                ->pluck('id');
            $query->whereIn('products.category_id', $ids);
        }

        $types = array_unique($filters['type'] ?? []);
        if (count($types) === 1) {
            $query->where('products.type', Product::typeFromApi($types[0]));
        }

        if (! empty($filters['region'])) {
            $query->whereHas('supplier', fn (Builder $s) => $s->whereIn('region_id', $filters['region']));
        }

        if (isset($filters['price_min'])) {
            $query->where('products.price', '>=', $filters['price_min']);
        }

        if (isset($filters['price_max'])) {
            $query->where('products.price', '<=', $filters['price_max']);
        }

        if (isset($filters['delay'])) {
            $query->whereNotNull('products.availability_days')
                ->where('products.availability_days', '<=', (int) $filters['delay']);
        }

        if (isset($filters['rating'])) {
            $query->whereHas('supplier', fn (Builder $s) => $s->where('rating_avg', '>=', $filters['rating']));
        }

        if (isset($filters['supplier_id'])) {
            $query->where('products.supplier_id', (int) $filters['supplier_id']);
        }

        if (isset($filters['exclude'])) {
            $query->where('products.id', '!=', (int) $filters['exclude']);
        }
    }

    /**
     * Pertinence par défaut si des mots-clés sont saisis (titre avant description), sinon nouveautés.
     * Pour ces deux tris, les produits mis en avant passent en tête pendant leur période (SCRUM-40) ;
     * un tri choisi explicitement (prix, note) est respecté tel quel.
     *
     * @param  Builder<Product>  $query
     */
    private function applySort(Builder $query, ?string $sort, ?string $keywords): void
    {
        $sort ??= $keywords !== null ? 'relevance' : 'newest';

        if (! in_array($sort, ['price_asc', 'price_desc', 'rating'], true)) {
            $query->orderByRaw('CASE WHEN products.featured_until > ? THEN 0 ELSE 1 END', [now()]);
        }

        match ($sort) {
            'price_asc' => $query->orderBy('products.price')->orderByDesc('products.id'),
            'price_desc' => $query->orderByDesc('products.price')->orderByDesc('products.id'),
            'rating' => $query->orderByDesc(
                SupplierProfile::query()->select('rating_avg')->whereColumn('supplier_profiles.id', 'products.supplier_id')
            )->orderByDesc('products.id'),
            'relevance' => $keywords !== null
                ? $query->orderByRaw("CASE WHEN LOWER(products.title) LIKE ? ESCAPE '!' THEN 0 ELSE 1 END", [mb_strtolower('%'.$this->escapeLike($keywords).'%')])
                    ->orderByDesc('products.created_at')->orderByDesc('products.id')
                : $query->orderByDesc('products.created_at')->orderByDesc('products.id'),
            default => $query->orderByDesc('products.created_at')->orderByDesc('products.id'),
        };
    }

    private function escapeLike(string $value): string
    {
        // « ! » sert de caractère d'échappement (identique sous MySQL, SQLite et PostgreSQL).
        return str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $value);
    }
}
