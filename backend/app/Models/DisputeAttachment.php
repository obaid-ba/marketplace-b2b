<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Pièce jointe d'un litige (entité 28, SCRUM-67).
 * Stockée sur le disque privé et servie uniquement aux parties concernées.
 */
class DisputeAttachment extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'dispute_id',
        'file_path',
    ];

    public function dispute(): BelongsTo
    {
        return $this->belongsTo(Dispute::class);
    }
}
