<?php

namespace App\Models;

use Database\Factories\CategoryFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Catégorie du catalogue. Arborescence limitée à deux niveaux :
 * catégories principales (parent_id null) et sous-catégories.
 */
class Category extends Model
{
    /** @use HasFactory<CategoryFactory> */
    use HasFactory;

    public const MAX_NAME_LENGTH = 100;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'parent_id',
        'name',
        'position',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'parent_id' => 'integer',
            'position' => 'integer',
        ];
    }

    /**
     * Catégorie parente (auto-référence).
     */
    public function parent(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'parent_id');
    }

    /**
     * Sous-catégories, dans l'ordre d'affichage.
     */
    public function children(): HasMany
    {
        return $this->hasMany(Category::class, 'parent_id')->orderBy('position')->orderBy('id');
    }

    /**
     * Produits rattachés directement à cette catégorie.
     */
    public function products(): HasMany
    {
        return $this->hasMany(Product::class);
    }

    /**
     * Ordre d'affichage : position puis identifiant (départage stable).
     *
     * @param  Builder<Category>  $query
     */
    public function scopeOrdered(Builder $query): void
    {
        $query->orderBy('position')->orderBy('id');
    }

    /**
     * Catégories ayant le même parent (racines entre elles, sous-catégories d'un même parent entre elles).
     *
     * @param  Builder<Category>  $query
     */
    public function scopeSiblingsOf(Builder $query, ?int $parentId): void
    {
        $parentId === null ? $query->whereNull('parent_id') : $query->where('parent_id', $parentId);
    }

    public function isRoot(): bool
    {
        return $this->parent_id === null;
    }
}
