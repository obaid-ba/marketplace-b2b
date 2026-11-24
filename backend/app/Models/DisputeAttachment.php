<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Preuve jointe à un litige (photo ou PDF), sur le disque privé.
 */
class DisputeAttachment extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = ['dispute_id', 'file_path', 'original_name', 'mime', 'size'];

    /**
     * @var list<string>
     */
    protected $hidden = ['file_path'];

    public function dispute(): BelongsTo
    {
        return $this->belongsTo(Dispute::class);
    }
}
