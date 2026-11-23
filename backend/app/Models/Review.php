<?php

namespace App\Models;

use App\Enums\ReviewStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Avis client lié à une commande (SCRUM-65).
 */
class Review extends Model
{
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'order_id',
        'buyer_id',
        'supplier_id',
        'rating',
        'comment',
        'supplier_reply',
        'status',
        'ai_suspicion_score',
        'ai_sentiment',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => ReviewStatus::class,
            'rating' => 'integer',
            'ai_suspicion_score' => 'decimal:2',
        ];
    }

    /**
     * Commande ayant fait l'objet de l'avis.
     */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class, 'order_id');
    }

    /**
     * Acheteur ayant déposé l'avis.
     */
    public function buyer(): BelongsTo
    {
        return $this->belongsTo(BuyerProfile::class, 'buyer_id');
    }

    /**
     * Fournisseur évalué.
     */
    public function supplier(): BelongsTo
    {
        return $this->belongsTo(SupplierProfile::class, 'supplier_id');
    }

    /**
     * Signalements de cet avis (SCRUM-66).
     */
    public function reports(): HasMany
    {
        return $this->hasMany(ReviewReport::class);
    }

    public function scopePublished(Builder $query): void
    {
        $query->where('reviews.status', ReviewStatus::PUBLISHED->value);
    }

    public function authorDisplayName(): string
    {
        $user = $this->buyer?->user;
        if ($user === null) {
            return 'Client';
        }

        $first = trim((string) $user->first_name);
        $last = trim((string) $user->last_name);
        if ($first === '' && $last === '') {
            $parts = preg_split('/\s+/', trim((string) $user->name)) ?: [];
            $first = $parts[0] ?? 'Client';
            $last = $parts[1] ?? '';
        }

        return $last === '' ? $first : $first.' '.mb_strtoupper(mb_substr($last, 0, 1)).'.';
    }
}
