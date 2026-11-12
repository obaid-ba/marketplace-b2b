<?php

namespace App\Models;

use App\Enums\ValidationStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Profil d'entreprise d'un fournisseur (table supplier_profiles).
 * Version minimale pour SCRUM-24 ; l'inscription (SCRUM-22) et la validation admin (SCRUM-31) la complètent.
 */
class SupplierProfile extends Model
{
    protected $fillable = [
        'user_id',
        'company_name',
        'logo',
        'description',
        'sector',
        'region_id',
        'contact',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_published' => 'boolean',
            'validation_status' => ValidationStatus::class,
            'validated_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
