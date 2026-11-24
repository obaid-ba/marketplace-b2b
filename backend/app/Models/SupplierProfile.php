<?php

namespace App\Models;

use App\Enums\UserStatus;
use App\Enums\ValidationStatus;
use Database\Factories\SupplierProfileFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SupplierProfile extends Model
{
    /** @use HasFactory<SupplierProfileFactory> */
    use HasFactory;

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
        'rating_avg',
        'reviews_count',
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
     * Profils visibles dans le catalogue et les recherches : validés, publiés, dont le
     * compte est actif et non supprimé. Un fournisseur suspendu (SCRUM-118), désactivé
     * ou supprimé (SCRUM-30 / SCRUM-98) disparaît donc aussi de ces listes.
     *
     * @param  Builder<SupplierProfile>  $query
     */
    public function scopeVisibleInCatalog(Builder $query): void
    {
        $query->where('validation_status', ValidationStatus::VALIDATED->value)
            ->where('is_published', true)
            ->whereHas('user', fn (Builder $user) => $user->where('status', UserStatus::ACTIVE->value));
    }

    /**
     * Peut recevoir de nouvelles commandes : validé par l'admin et compte actif, non supprimé (SCRUM-118).
     */
    public function canSell(): bool
    {
        return $this->validation_status === ValidationStatus::VALIDATED && (bool) $this->user?->isActive();
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

    public function tenderRecipients(): HasMany
    {
        return $this->hasMany(TenderRecipient::class, 'supplier_id');
    }

    public function tenders(): HasMany
    {
        return $this->hasMany(Tender::class);
    }

    public function quotes(): HasMany
    {
        return $this->hasMany(Quote::class, 'supplier_id');
    }

    public function favoritedBy(): HasMany
    {
        return $this->hasMany(Favorite::class, 'supplier_id');
    }

    /**
     * Administrateur ayant validé ou refusé le profil.
     */
    public function validator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'validated_by');
    }

    /**
     * Commandes reçues par le fournisseur.
     */
    public function orders(): HasMany
    {
        return $this->hasMany(Order::class, 'supplier_id');
    }

    /**
     * Avis clients reçus par le fournisseur (SCRUM-65).
     */
    public function reviews(): HasMany
    {
        return $this->hasMany(Review::class, 'supplier_id');
    }
}
