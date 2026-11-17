<?php

namespace App\Http\Requests\Supplier;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Nouvel ordre des photos d'un produit (SCRUM-33) : { "image_ids": [7, 5, 6] }, la première devient l'image principale.
 */
class ReorderProductImagesRequest extends FormRequest
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
            'image_ids' => ['required', 'array', 'min:1'],
            'image_ids.*' => ['required', 'integer', 'distinct'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'image_ids.required' => 'Indiquez l\'ordre des photos.',
            'image_ids.*.distinct' => 'Une photo apparaît deux fois.',
        ];
    }
}
