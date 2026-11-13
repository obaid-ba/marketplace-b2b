<?php

namespace App\Http\Resources;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin User
 */
class UserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'role' => $this->role->value,
            'role_label' => $this->role->label(),
            'status' => $this->status->value,
            'email_verified' => $this->email_verified_at !== null,
            // Fournisseur uniquement : « en attente », « validé » ou « refusé » (validation par l'admin).
            'supplier_validation_status' => $this->when(
                $this->role === UserRole::Supplier,
                fn () => $this->supplierProfile?->validation_status?->value,
            ),
            // Fournisseur uniquement : nom affiché dans l'en-tête de l'espace fournisseur (SCRUM-28).
            'supplier_company_name' => $this->when(
                $this->role === UserRole::Supplier,
                fn () => $this->supplierProfile?->company_name,
            ),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
