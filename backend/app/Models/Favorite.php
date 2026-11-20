<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Fournisseur favori d'un porteur de projet (table favorites).
 * Sert notamment à l'invitation d'un fournisseur de confiance sur une demande (SCRUM-49).
 */
class Favorite extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'buyer_id',
        'supplier_id',
    ];

    public function buyer(): BelongsTo
    {
        return $this->belongsTo(BuyerProfile::class, 'buyer_id');
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(SupplierProfile::class, 'supplier_id');
    }
}
