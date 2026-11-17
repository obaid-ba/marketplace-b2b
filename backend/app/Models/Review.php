<?php

namespace App\Models;

use App\Enums\ReviewStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Avis d'un porteur de projet sur un fournisseur, après une commande (entité EP07).
 * Le dépôt d'avis arrive en S6 (SCRUM-64) ; le sprint 2 les affiche sur les fiches publiques.
 */
class Review extends Model
{
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
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'rating' => 'integer',
            'status' => ReviewStatus::class,
        ];
    }

    public function buyer(): BelongsTo
    {
        return $this->belongsTo(BuyerProfile::class, 'buyer_id');
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(SupplierProfile::class, 'supplier_id');
    }

    /**
     * Avis affichés publiquement : ni signalés en attente de modération, ni masqués.
     *
     * @param  Builder<Review>  $query
     */
    public function scopePublished(Builder $query): void
    {
        $query->where('reviews.status', ReviewStatus::PUBLISHED->value);
    }

    /**
     * Auteur affiché : prénom + initiale du nom (« Sana B. »), jamais le nom complet ni l'e-mail.
     */
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
