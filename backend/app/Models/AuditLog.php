<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

class AuditLog extends Model
{
    /**
     * La table audit_logs est non modifiable et ne possède pas updated_at.
     */
    public const UPDATED_AT = null;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'admin_id',
        'action',
        'target',
        'reason',
        'created_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'created_at' => 'datetime',
        ];
    }

    /**
     * Journal non modifiable (SCRUM-76) : une entrée ne se corrige ni ne s'efface depuis l'application.
     */
    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException("Le journal d'audit n'est pas modifiable."));
        static::deleting(fn () => throw new LogicException("Le journal d'audit n'est pas modifiable."));
    }

    /**
     * Administrateur ayant exécuté l'action.
     */
    public function admin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'admin_id')->withTrashed();
    }
}
