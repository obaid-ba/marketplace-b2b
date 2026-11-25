<?php

namespace App\Services;

use App\Enums\QuoteStatus;
use App\Models\BuyerProfile;
use App\Models\Category;
use App\Models\SupplierProfile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Fournisseurs recommandés au porteur de projet (SCRUM-87), sur son tableau de bord.
 *
 * Score = intérêt pour la catégorie (part de ses achats dans cette catégorie) × 60 + note du fournisseur × 8.
 * Les achats comptent les commandes (lignes de produits) et les devis acceptés. Sont exclus : ses favoris,
 * les fournisseurs avec qui il a déjà commandé (le but est d'en découvrir de nouveaux) et les comptes qui ne
 * sont pas visibles dans le catalogue (non validés, suspendus…). Chaque recommandation porte sa raison.
 * Sans historique d'achat, les fournisseurs les mieux notés sont proposés.
 */
class SupplierRecommendationService
{
    public const LIMIT = 4;

    /**
     * @return Collection<int, array{supplier: SupplierProfile, score: float, reason: string}>
     */
    public function forBuyer(BuyerProfile $buyer, int $limit = self::LIMIT): Collection
    {
        $interests = $this->categoryInterests($buyer);
        $excluded = $this->excludedSuppliers($buyer);

        $query = SupplierProfile::query()
            ->visibleInCatalog()
            ->whereNotIn('supplier_profiles.id', $excluded)
            ->with(['categories:id,name,parent_id', 'region:id,name']);

        if ($interests->isEmpty()) {
            return $query->where('reviews_count', '>', 0)
                ->orderByDesc('rating_avg')
                ->orderByDesc('reviews_count')
                ->limit($limit)
                ->get()
                ->map(fn (SupplierProfile $supplier) => [
                    'supplier' => $supplier,
                    'score' => round((float) $supplier->rating_avg * 8, 2),
                    'reason' => 'Parmi les fournisseurs les mieux notés ('.$this->rating($supplier).')',
                ]);
        }

        // Famille de chaque catégorie achetée : la catégorie, sa parente et ses sous-catégories.
        $families = $this->families($interests->keys()->all());

        return $query
            ->whereHas('categories', fn ($categories) => $categories->whereIn('categories.id', $families->flatten()->unique()))
            ->limit(100)
            ->get()
            ->map(function (SupplierProfile $supplier) use ($interests, $families) {
                $supplierCategories = $supplier->categories->pluck('id')->all();
                $best = $interests
                    ->filter(fn (array $interest, int $categoryId) => array_intersect($families[$categoryId], $supplierCategories) !== [])
                    ->sortByDesc('share')
                    ->first();

                return [
                    'supplier' => $supplier,
                    'score' => round($best['share'] * 60 + (float) $supplier->rating_avg * 8, 2),
                    'reason' => "Vous achetez en « {$best['name']} »".((int) $supplier->reviews_count > 0 ? ' · '.$this->rating($supplier) : ' · Nouveau sur la plateforme'),
                ];
            })
            ->sort(fn (array $a, array $b) => [$b['score'], $a['supplier']->id] <=> [$a['score'], $b['supplier']->id])
            ->take($limit)
            ->values();
    }

    /**
     * Part de chaque catégorie dans les achats du porteur.
     *
     * @return Collection<int, array{name: string, share: float}>
     */
    private function categoryInterests(BuyerProfile $buyer): Collection
    {
        $fromOrders = DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->join('products', 'products.id', '=', 'order_items.product_id')
            ->where('orders.buyer_id', $buyer->id)
            ->pluck('products.category_id');

        $fromQuotes = DB::table('quotes')
            ->join('tenders', 'tenders.id', '=', 'quotes.tender_id')
            ->where('tenders.buyer_id', $buyer->id)
            ->where('quotes.status', QuoteStatus::ACCEPTED->value)
            ->pluck('tenders.category_id');

        $counts = $fromOrders->concat($fromQuotes)->filter()->countBy();
        $total = max(1, $counts->sum());
        $names = Category::query()->whereIn('id', $counts->keys())->pluck('name', 'id');

        return $counts
            ->mapWithKeys(fn (int $count, int $categoryId) => [$categoryId => ['name' => $names[$categoryId] ?? 'cette catégorie', 'share' => $count / $total]]);
    }

    /**
     * @param  list<int>  $categoryIds
     * @return Collection<int, list<int>>
     */
    private function families(array $categoryIds): Collection
    {
        $categories = Category::query()->get(['id', 'parent_id']);

        return collect($categoryIds)->mapWithKeys(function (int $id) use ($categories) {
            $parent = $categories->firstWhere('id', $id)?->parent_id;

            return [$id => $categories
                ->filter(fn (Category $category) => in_array($category->id, [$id, $parent], true) || $category->parent_id === $id)
                ->pluck('id')
                ->values()
                ->all()];
        });
    }

    /**
     * @return Collection<int, int>
     */
    private function excludedSuppliers(BuyerProfile $buyer): Collection
    {
        return DB::table('favorites')->where('buyer_id', $buyer->id)->pluck('supplier_id')
            ->concat(DB::table('orders')->where('buyer_id', $buyer->id)->pluck('supplier_id'))
            ->unique()
            ->values();
    }

    private function rating(SupplierProfile $supplier): string
    {
        return 'note '.number_format((float) $supplier->rating_avg, 1, ',', '').' / 5 sur '.(int) $supplier->reviews_count.' avis';
    }
}
