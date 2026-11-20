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
 * Produit ou service du catalogue (SCRUM-34, SCRUM-51).
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
        'ai_flag_reason',
        'withdrawal_reason',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'stock' => 'integer',
            'status' => ProductStatus::class,
            'availability_days' => 'integer',
            'featured_until' => 'datetime',
        ];
    }

    /**
     * Fournisseur propriétaire du produit.
     */
    public function supplier(): BelongsTo
    {
        return $this->belongsTo(SupplierProfile::class, 'supplier_id');
    }

    /**
     * Catégorie du produit.
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'category_id');
    }

    /**
     * Lignes de commande faisant référence à ce produit.
     */
    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class, 'product_id');
    }

    public function images(): HasMany
    {
        return $this->hasMany(ProductImage::class)->orderBy('position')->orderBy('id');
    }

    public function views(): HasMany
    {
        return $this->hasMany(ProductView::class);
    }

    public function hasBeenOrdered(): bool
    {
        return DB::table('order_items')->where('product_id', $this->id)->exists();
    }

    public function mainImage(): HasOne
    {
        return $this->hasOne(ProductImage::class)->ofMany(['position' => 'min', 'id' => 'min']);
    }

    public function apiType(): string
    {
        return $this->type === self::TYPE_SERVICE ? 'service' : 'product';
    }

    public static function typeFromApi(string $type): string
    {
        return $type === 'service' ? self::TYPE_SERVICE : self::TYPE_PRODUCT;
    }

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

    public function scopeVisible(Builder $query): void
    {
        $query->where('status', ProductStatus::PUBLISHED->value)
            ->whereHas('supplier', fn (Builder $supplier) => $supplier->where('is_published', true));
    }
}
