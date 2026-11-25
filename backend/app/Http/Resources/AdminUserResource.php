<?php

namespace App\Http\Resources;

use App\Enums\UserRole;
use App\Models\User;
use App\Services\UserAdministrationService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Compte vu par l'administrateur (SCRUM-118).
 *
 * @mixin User
 */
class AdminUserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $supplier = $this->role === UserRole::Supplier ? $this->supplierProfile : null;
        $buyer = $this->role === UserRole::Buyer ? $this->buyerProfile : null;
        $refusal = app(UserAdministrationService::class)->refusalFor($this->resource, $request->user());

        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'role' => $this->role->value,
            'role_label' => $this->role->label(),
            'status' => $this->trashed() ? 'supprimé' : $this->status->value,
            'email_verified' => $this->hasVerifiedEmail(),
            'organization' => $supplier?->company_name ?? $buyer?->organization,
            'supplier' => $supplier ? [
                'id' => $supplier->id,
                'validation_status' => $supplier->validation_status?->value,
                'is_published' => $supplier->is_published,
                'rating_avg' => (float) $supplier->rating_avg,
                'reviews_count' => (int) $supplier->reviews_count,
            ] : null,
            'created_at' => $this->created_at?->toIso8601String(),
            'last_login_at' => $this->last_login_at?->toIso8601String(),
            'deleted_at' => $this->deleted_at?->toIso8601String(),
            'can_suspend' => $refusal === null && ! $this->isBlocked(),
            'can_reactivate' => $refusal === null && $this->isBlocked(),
            'can_delete' => $refusal === null,
            'locked_reason' => $refusal,
        ];
    }
}
