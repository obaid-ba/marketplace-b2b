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
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'email' => $this->email,
            'phone' => $this->phone,
            'avatar' => $this->avatar,
            'role' => $this->role->value,
            'role_label' => $this->role->label(),
            'status' => $this->status->value,
            'email_verified' => $this->email_verified_at !== null,
            // Fournisseur uniquement : « en attente », « validé » ou « refusé » (validation par l'admin).
            'supplier_validation_status' => $this->when(
                $this->role === UserRole::Supplier,
                fn () => $this->supplierProfile?->validation_status?->value,
            ),
            // Porteur de projet uniquement : informations modifiables dans les paramètres du compte.
            'buyer_profile' => $this->when(
                $this->role === UserRole::Buyer,
                fn () => $this->buyerProfile ? [
                    'organization' => $this->buyerProfile->organization,
                    'sector' => $this->buyerProfile->sector,
                    'buyer_type' => $this->buyerProfile->buyer_type,
                    'job_title' => $this->buyerProfile->job_title,
                    'region_id' => $this->buyerProfile->region_id,
                    'city' => $this->buyerProfile->city,
                    'address' => $this->buyerProfile->address,
                    'website' => $this->buyerProfile->website,
                    'project_description' => $this->buyerProfile->project_description,
                ] : null,
            ),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
