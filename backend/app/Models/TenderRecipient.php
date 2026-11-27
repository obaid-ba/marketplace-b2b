<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Fournisseur destinataire d'une demande (table tender_recipients).
 * Conserve le score de pertinence et les dates de notification / consultation.
 */
class TenderRecipient extends Model
{
    public const SOURCE_AUTOMATIC = 'automatique';

    public const SOURCE_AI = 'suggéré IA';

    public const SOURCE_INVITED = 'invité';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'tender_id',
        'supplier_id',
        'score',
        'source',
        'notified_at',
        'seen_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'score' => 'decimal:2',
            'notified_at' => 'datetime',
            'seen_at' => 'datetime',
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
}
