<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Ligne d'article dans une commande (SCRUM-51 / F16).
 * Fige la désignation et le prix unitaire au moment de la commande.
 */
class OrderItem extends Model
{
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'order_id',
        'product_id',
        'label',
        'quantity',
        'unit_price',
    ];

    /**
     * @var list<string>
     */
    protected $appends = [
        'line_total',
    ];

    /**
     * Total de la ligne (quantité * prix unitaire).
     */
    public function getLineTotalAttribute(): string
    {
        return number_format($this->quantity * (float) $this->unit_price, 2, '.', '');
    }

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'unit_price' => 'decimal:2',
        ];
    }

    /**
     * Commande parente.
     */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class, 'order_id');
    }

    /**
     * Produit d'origine (nullable si supprimé du catalogue ultérieurement).
     */
    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class, 'product_id');
    }
}
