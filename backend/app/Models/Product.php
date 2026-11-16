<?php

namespace App\Models;

use App\Enums\ProductStatus;
use Database\Factories\ProductFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Produit ou service proposé par un fournisseur (entité 8).
 * Le modèle est complété au fil du sprint 2 (catalogue SCRUM-35, ajout SCRUM-33, liste SCRUM-34).
 */
class Product extends Model
{
    /** @use HasFactory<ProductFactory> */
    use HasFactory;

    public const TYPE_PRODUCT = 'produit';

    public const TYPE_SERVICE = 'service';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'supplier_id',
        'category_id',
        'type',
        'title',
        'description',
        'price',
        'unit',
        'stock',
        'availability_days',
        'status',
        'featured_until',
        'withdrawal_reason',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => ProductStatus::class,
            'price' => 'decimal:2',
            'stock' => 'integer',
            'availability_days' => 'integer',
            'featured_until' => 'datetime',
        ];
    }

    /**
     * Fournisseur qui propose le produit.
     */
    public function supplier(): BelongsTo
    {
        return $this->belongsTo(SupplierProfile::class, 'supplier_id');
    }

    /**
     * Catégorie (ou sous-catégorie) du produit.
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    /**
     * Seuls ces produits apparaissent côté public (catalogue, fiches, accueil, compteurs) :
     * produit publié d'un fournisseur validé, actif et dont le profil est publié.
     *
     * @param  Builder<Product>  $query
     */
    public function scopeVisible(Builder $query): void
    {
        $query->where('products.status', ProductStatus::PUBLISHED->value)
            ->whereHas('supplier', fn (Builder $supplier) => $supplier->visibleInCatalog());
    }
}
