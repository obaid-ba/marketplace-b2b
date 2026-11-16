<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

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

    /**
     * Fournisseurs favoris (SCRUM-39). Unicité (buyer, supplier) garantie par la base.
     */
    public function favoriteSuppliers(): BelongsToMany
    {
        return $this->belongsToMany(SupplierProfile::class, 'favorites', 'buyer_id', 'supplier_id')->withTimestamps();
    }
}
