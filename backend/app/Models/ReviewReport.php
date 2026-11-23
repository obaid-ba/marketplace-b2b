<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Signalement d'un avis abusif par le fournisseur concerné (SCRUM-66). Décision de l'admin : F29 / SCRUM-74.
 */
class ReviewReport extends Model
{
    public const STATUS_PENDING = 'en attente';

    /**
     * Motifs proposés (valeur enregistrée => libellé affiché).
     *
     * @var array<string, string>
     */
    public const REASONS = [
        'insultes' => 'Propos injurieux ou diffamatoires',
        'faux_avis' => 'Faux avis ou avis intéressé',
        'hors_sujet' => 'Sans rapport avec la commande',
        'donnees_personnelles' => 'Divulgation de données personnelles',
        'autre' => 'Autre motif',
    ];

    /**
     * @var list<string>
     */
    protected $fillable = ['review_id', 'author_id', 'reason', 'details', 'status', 'admin_decision'];

    public function review(): BelongsTo
    {
        return $this->belongsTo(Review::class);
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }
}
