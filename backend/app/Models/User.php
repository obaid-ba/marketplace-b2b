<?php

namespace App\Models;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'phone',
        'password',
        'role',
        'status',
    ];

    /**
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
            'role' => UserRole::class,
            'status' => UserStatus::class,
        ];
    }

    /** @return HasOne<SupplierProfile, $this> */
    public function supplierProfile(): HasOne
    {
        return $this->hasOne(SupplierProfile::class);
    }

    /** @return HasOne<BuyerProfile, $this> */
    public function buyerProfile(): HasOne
    {
        return $this->hasOne(BuyerProfile::class);
    }

    public function hasRole(UserRole $role): bool
    {
        return $this->role === $role;
    }

    public function isActive(): bool
    {
        return $this->status === UserStatus::ACTIVE;
    }

    /**
     * Un compte suspendu ou désactivé ne peut pas se connecter.
     * Un compte dont l'e-mail reste à vérifier le peut, pour demander un nouveau lien (SCRUM-24),
     * mais le middleware "verified" lui ferme les espaces fournisseur / porteur / admin.
     */
    public function isBlocked(): bool
    {
        return in_array($this->status, [UserStatus::SUSPENDED, UserStatus::DEACTIVATED], true);
    }

    /**
     * Vérification de l'e-mail : le compte passe aussi de « e-mail à vérifier » à « actif ».
     * Un fournisseur reste ensuite « en attente » de validation sur son profil (SupplierProfile).
     */
    public function markEmailAsVerified(): bool
    {
        $attributes = ['email_verified_at' => $this->freshTimestamp()];

        if ($this->status === UserStatus::EMAIL_TO_VERIFY) {
            $attributes['status'] = UserStatus::ACTIVE;
        }

        return $this->forceFill($attributes)->save();
    }
}
