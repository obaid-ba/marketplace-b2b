<?php

namespace App\Models;

use App\Enums\OrderStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * Commande B2B (SCRUM-51, SCRUM-58 / F16).
 * Cycle de vie : validée → expédiée → livrée → clôturée.
 */
class Order extends Model
{
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'buyer_id',
        'supplier_id',
        'quote_id',
        'origin',
        'total',
        'status',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => OrderStatus::class,
            'total' => 'decimal:2',
        ];
    }

    /**
     * Acheteur / Porteur de projet ayant passé la commande.
     */
    public function buyer(): BelongsTo
    {
        return $this->belongsTo(BuyerProfile::class, 'buyer_id');
    }

    /**
     * Fournisseur destinataire de la commande.
     */
    public function supplier(): BelongsTo
    {
        return $this->belongsTo(SupplierProfile::class, 'supplier_id');
    }

    /**
     * Devis d'origine si la commande découle d'un appel d'offres.
     */
    public function quote(): BelongsTo
    {
        return $this->belongsTo(Quote::class, 'quote_id');
    }

    /**
     * Lignes d'articles commandés (avec prix et libellés figés).
     */
    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class, 'order_id');
    }

    /**
     * Historique chronologique des changements de statut.
     */
    public function statusHistory(): HasMany
    {
        return $this->hasMany(OrderStatusHistory::class, 'order_id')
            ->orderBy('changed_at', 'asc')
            ->orderBy('id', 'asc');
    }

    /**
     * Documents commerciaux associés (devis, facture).
     */
    public function documents(): HasMany
    {
        return $this->hasMany(Document::class, 'order_id');
    }

    /**
     * Avis éventuel déposé sur cette commande.
     */
    public function review(): HasOne
    {
        return $this->hasOne(Review::class, 'order_id');
    }
}
