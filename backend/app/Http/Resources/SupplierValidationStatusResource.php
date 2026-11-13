<?php

namespace App\Http\Resources;

use App\Enums\ValidationStatus;
use App\Models\SupplierProfile;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * État du dossier d'un fournisseur (page « Compte en attente de validation », SCRUM-27).
 *
 * @mixin SupplierProfile
 */
class SupplierValidationStatusResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $status = $this->validation_status;

        return [
            // « en attente », « validé » ou « refusé » (mêmes valeurs que ValidationStatus).
            'status' => $status->value,
            'rejection_reason' => $status === ValidationStatus::REJECTED ? $this->rejection_reason : null,
            'steps' => [
                'account_created_at' => $this->user->created_at?->toIso8601String(),
                'email_verified_at' => $this->user->email_verified_at?->toIso8601String(),
                // Date de la décision de l'administrateur (validation ou refus) : colonne validated_at.
                'reviewed_at' => $status === ValidationStatus::PENDING
                    ? null
                    : $this->validated_at?->toIso8601String(),
            ],
            'is_published' => $this->is_published,
            'documents' => SupplierDocumentResource::collection($this->whenLoaded('documents')),
        ];
    }
}
