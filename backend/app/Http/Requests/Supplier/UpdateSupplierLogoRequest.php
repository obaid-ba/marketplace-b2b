<?php

namespace App\Http\Requests\Supplier;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Changement du logo de l'entreprise (SCRUM-28).
 */
class UpdateSupplierLogoRequest extends FormRequest
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
            'logo' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'logo.required' => 'Choisissez une image.',
            'logo.file' => 'Le logo doit être un fichier.',
            'logo.image' => 'Le logo doit être une image (JPG, PNG ou WebP).',
            'logo.mimes' => 'Le logo doit être une image (JPG, PNG ou WebP).',
            'logo.max' => 'Le logo ne doit pas dépasser 2 Mo.',
        ];
    }
}
