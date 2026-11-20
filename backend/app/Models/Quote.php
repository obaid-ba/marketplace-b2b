<?php

namespace App\Models;

use App\Enums\QuoteStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * Devis soumis par un fournisseur en réponse à un appel d'offres (SCRUM-46).
 */
class Quote extends Model
{
    use HasFactory;

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

    /**
     * Fournisseur émetteur du devis.
     */
    public function supplier(): BelongsTo
    {
        return $this->belongsTo(SupplierProfile::class, 'supplier_id');
    }

    /**
     * Commande générée à partir de ce devis si accepté.
     */
    public function order(): HasOne
    {
        return $this->hasOne(Order::class, 'quote_id');
    }

    public function isEditable(): bool
    {
        return $this->status !== QuoteStatus::ACCEPTED;
    }
}
