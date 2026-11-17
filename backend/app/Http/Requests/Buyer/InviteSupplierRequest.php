<?php

namespace App\Http\Requests\Buyer;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Invitation d'un fournisseur favori sur une demande (SCRUM-49).
 */
class InviteSupplierRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'supplier_id' => ['required', 'integer', 'exists:supplier_profiles,id'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'supplier_id.required' => 'Choisissez un fournisseur à inviter.',
            'supplier_id.exists' => 'Ce fournisseur n’existe pas.',
        ];
    }
}
