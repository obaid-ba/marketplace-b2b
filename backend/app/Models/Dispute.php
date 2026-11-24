<?php

namespace App\Models;

use App\Enums\DisputeStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Litige ouvert par un acheteur sur une commande (entité 27, SCRUM-67 / F21).
 *
 * Un seul litige non décidé peut être ouvert par commande. Le litige passe de
 * `ouvert` à `en cours` lors de sa prise en charge, puis à `décidé` avec une
 * décision et une note motivée.
 */
class Dispute extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'order_id',
        'opened_by',
        'reason',
        'description',
        'status',
        'assigned_admin_id',
        'decision',
        'decision_note',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => DisputeStatus::class,
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    /**
     * Utilisateur ayant ouvert le litige.
     */
    public function opener(): BelongsTo
    {
        return $this->belongsTo(User::class, 'opened_by');
    }

    /**
     * Administrateur en charge du litige.
     */
    public function assignedAdmin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_admin_id');
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(DisputeAttachment::class);
    }

    public function isDecided(): bool
    {
        return $this->status === DisputeStatus::DECIDED;
    }
}
