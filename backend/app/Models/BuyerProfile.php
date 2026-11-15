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
        'buyer_type',
        'organization',
        'job_title',
        'cin',
        'sector',
        'region_id',
        'city',
        'address',
        'website',
        'project_description',
        'tax_id',
        'discovery_source',
        'terms_accepted_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'terms_accepted_at' => 'datetime',
        ];
    }

    /**
     * Utilisateur propriétaire du profil.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Région du porteur de projet.
     */
    public function region(): BelongsTo
    {
        return $this->belongsTo(Region::class);
    }
}
