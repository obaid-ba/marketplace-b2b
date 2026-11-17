<?php

namespace App\Models;

use App\Enums\TenderStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Demande (appel d'offres) publiée par un porteur de projet (SCRUM-41 / F11).
 */
class Tender extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'buyer_id',
        'title',
        'description',
        'category_id',
        'region_id',
        'budget',
        'desired_deadline',
        'status',
        'ai_category_id',
        'ai_keywords',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'budget' => 'decimal:2',
            'desired_deadline' => 'date',
            'status' => TenderStatus::class,
            'ai_keywords' => 'array',
        ];
    }

    /**
     * Porteur de projet propriétaire de la demande.
     */
    public function buyer(): BelongsTo
    {
        return $this->belongsTo(BuyerProfile::class, 'buyer_id');
    }

    /**
     * Catégorie principale du besoin.
     */
    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    /**
     * Catégorie proposée par l'IA (S6), sans effet sur la v1 du score.
     */
    public function aiCategory(): BelongsTo
    {
        return $this->belongsTo(Category::class, 'ai_category_id');
    }

    /**
     * Région souhaitée pour la prestation.
     */
    public function region(): BelongsTo
    {
        return $this->belongsTo(Region::class);
    }

    /**
     * Pièces jointes déposées par le porteur.
     */
    public function attachments(): HasMany
    {
        return $this->hasMany(TenderAttachment::class);
    }

    /**
     * Fournisseurs destinataires de la demande (diffusion automatique ou invitation).
     */
    public function recipients(): HasMany
    {
        return $this->hasMany(TenderRecipient::class);
    }

    /**
     * Devis reçus pour cette demande.
     */
    public function quotes(): HasMany
    {
        return $this->hasMany(Quote::class);
    }

    /**
     * Une demande reste ouverte tant qu'elle n'est ni clôturée ni annulée.
     *
     * @param  Builder<Tender>  $query
     */
    public function scopeOpen(Builder $query): void
    {
        $query->whereIn('status', [TenderStatus::OPEN->value, TenderStatus::IN_NEGOTIATION->value]);
    }

    public function isOpen(): bool
    {
        return in_array($this->status, [TenderStatus::OPEN, TenderStatus::IN_NEGOTIATION], true);
    }

    public function statusLabel(): ?string
    {
        return match ($this->status) {
            TenderStatus::OPEN => 'Ouverte',
            TenderStatus::IN_NEGOTIATION => 'En négociation',
            TenderStatus::CLOSED => 'Clôturée',
            TenderStatus::CANCELLED => 'Annulée',
            default => null,
        };
    }
}
