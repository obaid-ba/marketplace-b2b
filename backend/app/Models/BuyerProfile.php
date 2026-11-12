<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Profil d'un porteur de projet (table buyer_profiles).
 * Créé à l'inscription (SCRUM-23) ; complété par les stories de l'espace porteur.
 */
class BuyerProfile extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'organization',
        'sector',
    ];

    /**
     * Utilisateur propriétaire du profil.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
