<?php

namespace App\Models;

use App\Enums\DisputeDecision;
use App\Enums\DisputeStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Litige ouvert par l'acheteur sur une commande (SCRUM-117 / F23).
 * Cycle : ouvert → en cours (pris en charge par un admin) → décidé.
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
        'decided_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => DisputeStatus::class,
            'decision' => DisputeDecision::class,
            'decided_at' => 'datetime',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function opener(): BelongsTo
    {
        return $this->belongsTo(User::class, 'opened_by')->withTrashed();
    }

    public function assignedAdmin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_admin_id')->withTrashed();
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(DisputeAttachment::class);
    }

    /**
     * @param  Builder<Dispute>  $query
     */
    public function scopeUndecided(Builder $query): void
    {
        $query->where('status', '!=', DisputeStatus::DECIDED->value);
    }
}
