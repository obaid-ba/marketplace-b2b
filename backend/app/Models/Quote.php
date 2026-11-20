<?php

namespace App\Models;

use App\Enums\QuoteStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * Devis d'un fournisseur en réponse à une demande (règle #1 : un seul devis
 * par couple demande / fournisseur).
 */
class Quote extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'tender_id',
        'supplier_id',
        'amount',
        'delivery_days',
        'conditions',
        'comment',
        'status',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'delivery_days' => 'integer',
            'status' => QuoteStatus::class,
        ];
    }

    public function tender(): BelongsTo
    {
        return $this->belongsTo(Tender::class);
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(SupplierProfile::class, 'supplier_id');
    }

    public function order(): HasOne
    {
        return $this->hasOne(Order::class);
    }

    /**
     * Un devis reste modifiable tant qu'il n'a pas été accepté.
     */
    public function isEditable(): bool
    {
        return $this->status !== QuoteStatus::ACCEPTED;
    }
}
