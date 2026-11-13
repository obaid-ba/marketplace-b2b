<?php

namespace App\Http\Requests\Supplier;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Interrupteur « Profil publié » (SCRUM-28).
 */
class PublishSupplierProfileRequest extends FormRequest
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
            'is_published' => ['required', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'is_published.required' => 'Indiquez si le profil doit être publié.',
            'is_published.boolean' => 'La valeur de publication est invalide.',
        ];
    }
}
