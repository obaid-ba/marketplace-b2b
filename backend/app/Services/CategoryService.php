<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Gestion de l'arborescence des catégories (SCRUM-32).
 *
 * Les positions sont des entiers 1, 2, 3… sans trou, propres à chaque groupe de catégories
 * sœurs (les racines entre elles, les sous-catégories d'un même parent entre elles).
 * Chaque action de l'administrateur est tracée dans audit_logs.
 */
class CategoryService
{
    /**
     * Arbre complet trié par position, avec le nombre de produits de chaque nœud.
     * Le compteur d'une catégorie principale inclut celui de ses sous-catégories.
     *
     * @param  bool  $publicCounts  true : produits visibles uniquement (catalogue public) ;
     *                              false : tous les produits + nombre de demandes (back-office).
     * @return Collection<int, Category>
     */
    public function tree(bool $publicCounts): Collection
    {
        $roots = Category::query()
            ->whereNull('parent_id')
            ->ordered()
            ->with('children')
            ->get(['id', 'parent_id', 'name', 'position']);

        $products = ($publicCounts ? Product::query()->visible() : Product::query())
            ->toBase()
            ->selectRaw('products.category_id, count(*) as aggregate')
            ->groupBy('products.category_id')
            ->pluck('aggregate', 'category_id');

        $tenders = $publicCounts ? collect() : DB::table('tenders')
            ->selectRaw('category_id, count(*) as aggregate')
            ->groupBy('category_id')
            ->pluck('aggregate', 'category_id');

        foreach ($roots as $root) {
            $rootProducts = (int) $products->get($root->id, 0);
            $rootTenders = (int) $tenders->get($root->id, 0);

            foreach ($root->children as $child) {
                $child->products_count = (int) $products->get($child->id, 0);
                $rootProducts += $child->products_count;

                if (! $publicCounts) {
                    $child->tenders_count = (int) $tenders->get($child->id, 0);
                    $rootTenders += $child->tenders_count;
                }
            }

            $root->products_count = $rootProducts;
            if (! $publicCounts) {
                $root->tenders_count = $rootTenders;
            }
        }

        return $roots;
    }

    /**
     * @param  array{name: string, parent_id?: int|null, position?: int|null}  $data
     */
    public function create(array $data, User $admin): Category
    {
        return DB::transaction(function () use ($data, $admin) {
            $category = new Category(['name' => trim($data['name'])]);
            $this->place($category, $data['parent_id'] ?? null, $data['position'] ?? null);

            $this->audit($admin, 'category.created', $category, "Création de la catégorie « {$category->name} »");

            return $category;
        });
    }

    /**
     * Renommer, changer de parent et/ou de position.
     *
     * @param  array{name?: string, parent_id?: int|null, position?: int|null}  $data
     */
    public function update(Category $category, array $data, User $admin): Category
    {
        return DB::transaction(function () use ($category, $data, $admin) {
            $oldName = $category->name;
            $oldParentId = $category->parent_id;
            $newParentId = array_key_exists('parent_id', $data) ? $data['parent_id'] : $oldParentId;

            if (array_key_exists('name', $data)) {
                $category->name = trim($data['name']);
            }

            $parentChanged = $newParentId !== $oldParentId;
            $position = $data['position'] ?? ($parentChanged ? null : $category->position);
            $this->place($category, $newParentId, $position);

            if ($parentChanged) {
                $this->compact($oldParentId);
            }

            $reason = $oldName !== $category->name
                ? "Catégorie « {$oldName} » renommée en « {$category->name} »"
                : "Modification de la catégorie « {$category->name} »";
            $this->audit($admin, 'category.updated', $category, $reason);

            return $category;
        });
    }

    /**
     * Monter / descendre d'un rang ($direction) ou aller directement à une position.
     */
    public function move(Category $category, ?string $direction, ?int $position, User $admin): Category
    {
        return DB::transaction(function () use ($category, $direction, $position, $admin) {
            $this->compact($category->parent_id);
            $category->refresh();

            $target = match ($direction) {
                'up' => $category->position - 1,
                'down' => $category->position + 1,
                default => $position,
            };

            $this->place($category, $category->parent_id, $target);
            $this->audit($admin, 'category.moved', $category, "Catégorie « {$category->name} » déplacée en position {$category->position}");

            return $category;
        });
    }

    /**
     * Suppression refusée si la catégorie a des sous-catégories ou si des produits ou demandes l'utilisent.
     *
     * @throws ValidationException
     */
    public function delete(Category $category, User $admin): void
    {
        $childrenCount = $category->children()->count();
        // Les produits supprimés (suppression douce, SCRUM-34) gardent leur catégorie : ils comptent aussi.
        $productsCount = Product::withTrashed()->where('category_id', $category->id)->count();
        $tendersCount = DB::table('tenders')->where('category_id', $category->id)->count();

        if ($childrenCount > 0) {
            throw ValidationException::withMessages([
                'category' => "Impossible de supprimer « {$category->name} » : elle contient "
                    .$this->plural($childrenCount, 'sous-catégorie', 'sous-catégories')
                    .'. Déplacez-les ou supprimez-les d\'abord.',
            ]);
        }

        if ($productsCount > 0 || $tendersCount > 0) {
            $uses = array_filter([
                $productsCount > 0 ? $this->plural($productsCount, 'produit', 'produits') : null,
                $tendersCount > 0 ? $this->plural($tendersCount, 'demande', 'demandes') : null,
            ]);

            throw ValidationException::withMessages([
                'category' => "Impossible de supprimer « {$category->name} » : elle est utilisée par "
                    .implode(' et ', $uses).'. Rattachez-les à une autre catégorie d\'abord.',
            ]);
        }

        DB::transaction(function () use ($category, $admin) {
            $parentId = $category->parent_id;
            $category->delete();
            $this->compact($parentId);

            $this->audit($admin, 'category.deleted', $category, "Suppression de la catégorie « {$category->name} »");
        });
    }

    /**
     * Le nom est-il déjà pris par une catégorie sœur ? (insensible à la casse)
     */
    public function nameTaken(string $name, ?int $parentId, ?int $ignoreId = null): bool
    {
        return Category::query()
            ->siblingsOf($parentId)
            ->when($ignoreId, fn ($query) => $query->whereKeyNot($ignoreId))
            ->whereRaw('LOWER(name) = ?', [mb_strtolower(trim($name))])
            ->exists();
    }

    /**
     * Insère la catégorie à la position voulue (bornée) parmi ses sœurs et renumérote le groupe.
     * Sans position : à la fin.
     */
    private function place(Category $category, ?int $parentId, ?int $position): void
    {
        $siblings = Category::query()
            ->siblingsOf($parentId)
            ->when($category->exists, fn ($query) => $query->whereKeyNot($category->id))
            ->ordered()
            ->get(['id', 'position']);

        $index = $position === null ? $siblings->count() : max(0, min($position - 1, $siblings->count()));

        $category->parent_id = $parentId;
        $category->position = $index + 1;
        $category->save();

        $siblings->splice($index, 0, [$category]);
        $this->renumber($siblings);
    }

    /**
     * Supprime les trous de numérotation dans un groupe de catégories sœurs.
     */
    private function compact(?int $parentId): void
    {
        $this->renumber(Category::query()->siblingsOf($parentId)->ordered()->get(['id', 'position']));
    }

    /**
     * @param  \Illuminate\Support\Collection<int, Category>  $ordered
     */
    private function renumber($ordered): void
    {
        foreach ($ordered->values() as $index => $sibling) {
            if ($sibling->position !== $index + 1) {
                Category::query()->whereKey($sibling->id)->update(['position' => $index + 1]);
                $sibling->position = $index + 1;
            }
        }
    }

    private function audit(User $admin, string $action, Category $category, string $reason): void
    {
        AuditLog::create([
            'admin_id' => $admin->id,
            'action' => $action,
            'target' => "category:{$category->id}",
            'reason' => $reason,
        ]);
    }

    private function plural(int $count, string $singular, string $plural): string
    {
        return $count.' '.($count > 1 ? $plural : $singular);
    }
}
