<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Signalement d'un avis par un utilisateur (entité 26, SCRUM-74 / F29).
 *
 * Un avis signalé entre dans la file de modération. L'administrateur conserve
 * l'avis (`traitée`, décision « conservé ») ou le masque (`traitée`, décision
 * « masqué »). Le statut du signalement ne modifie jamais l'avis à lui seul.
 */
class ReviewReport extends Model
{
    public const STATUS_PENDING = 'en attente';

    public const STATUS_RESOLVED = 'traitée';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'review_id',
        'author_id',
        'reason',
        'status',
        'admin_decision',
    ];

    public function review(): BelongsTo
    {
        return $this->belongsTo(Review::class);
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }
}
