<?php

namespace App\Models;

use App\Enums\ProductStatus;
use Database\Factories\ProductFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;

/**
 * Produit ou service proposé par un fournisseur (entité 8).
 * Le modèle est complété au fil du sprint 2 (catalogue SCRUM-35, ajout SCRUM-33, liste SCRUM-34).
 */
class Product extends Model
{
    /** @use HasFactory<ProductFactory> */
    use HasFactory, SoftDeletes;

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
     * Photos dans l'ordre d'affichage (la première est l'image principale).
     */
    public function images(): HasMany
    {
        return $this->hasMany(ProductImage::class)->orderBy('position')->orderBy('id');
    }

    /**
     * Consultations de la fiche produit (SCRUM-34 : nombre de vues, SCRUM-36 : enregistrement).
     */
    public function views(): HasMany
    {
        return $this->hasMany(ProductView::class);
    }

    /**
     * Un produit déjà commandé n'est jamais supprimé physiquement (SCRUM-34).
     */
    public function hasBeenOrdered(): bool
    {
        return DB::table('order_items')->where('product_id', $this->id)->exists();
    }

    /**
     * Image principale seule (cartes du catalogue) : chargée en une requête pour toute une page.
     */
    public function mainImage(): HasOne
    {
        return $this->hasOne(ProductImage::class)->ofMany(['position' => 'min', 'id' => 'min']);
    }

    /**
     * Type exposé par l'API (« product » / « service ») ; la base stocke « produit » / « service ».
     */
    public function apiType(): string
    {
        return $this->type === self::TYPE_SERVICE ? 'service' : 'product';
    }

    public static function typeFromApi(string $type): string
    {
        return $type === 'service' ? self::TYPE_SERVICE : self::TYPE_PRODUCT;
    }

    /** Statuts exposés par l'API (anglais) ↔ statuts stockés (ProductStatus, français). */
    public const API_STATUSES = [
        'draft' => ProductStatus::DRAFT,
        'published' => ProductStatus::PUBLISHED,
        'withdrawn' => ProductStatus::WITHDRAWN,
    ];

    public function apiStatus(): string
    {
        return array_search($this->status, self::API_STATUSES, true) ?: 'draft';
    }

    public static function statusFromApi(string $status): ProductStatus
    {
        return self::API_STATUSES[$status] ?? ProductStatus::DRAFT;
    }

    public function isWithdrawn(): bool
    {
        return $this->status === ProductStatus::WITHDRAWN;
    }

    public function isService(): bool
    {
        return $this->type === self::TYPE_SERVICE;
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
