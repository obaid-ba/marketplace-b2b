<?php

namespace App\Models;

use App\Enums\ValidationStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SupplierProfile extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'company_name',
        'legal_form',
        'tax_id',
        'rne_number',
        'founded_year',
        'employees_count',
        'logo',
        'description',
        'sector',
        'region_id',
        'address',
        'city',
        'website',
        'professional_email',
        'professional_phone',
        'contact_name',
        'contact_role',
        'contact_phone',
        'delivery_days',
        'payment_terms',
        'contact',
        'is_published',
        'validation_status',
        'rejection_reason',
        'validated_by',
        'validated_at',
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
            'rating_avg' => 'decimal:2',
        ];
    }

    /**
     * Utilisateur propriétaire du profil fournisseur.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Région du siège.
     */
    public function region(): BelongsTo
    {
        return $this->belongsTo(Region::class);
    }

    /**
     * Documents justificatifs du fournisseur.
     */
    public function documents(): HasMany
    {
        return $this->hasMany(SupplierDocument::class, 'supplier_id');
    }

    /**
     * Catégories rattachées au fournisseur.
     */
    public function categories(): BelongsToMany
    {
        return $this->belongsToMany(Category::class, 'supplier_category', 'supplier_id', 'category_id');
    }

    /**
     * Zones de couverture (régions desservies).
     */
    public function coverageRegions(): BelongsToMany
    {
        return $this->belongsToMany(Region::class, 'supplier_coverage_region', 'supplier_id', 'region_id');
    }
}
