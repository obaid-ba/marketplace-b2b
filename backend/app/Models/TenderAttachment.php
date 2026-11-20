<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Pièce jointe d'une demande (cahier des charges, photo, devis modèle…).
 */
class TenderAttachment extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'tender_id',
        'file_path',
        'original_name',
    ];

    public function tender(): BelongsTo
    {
        return $this->belongsTo(Tender::class);
    }
}
