<?php

namespace App\Http\Requests\Supplier;

use App\Models\Product;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Nouvel ordre des photos d'un produit (SCRUM-33) : { "image_ids": [7, 5, 6] }, la première devient l'image principale.
 */
class ReorderProductImagesRequest extends FormRequest
{
    /**
     * Contrôle de propriété AVANT la validation (SCRUM-90) : le produit d'un autre fournisseur répond 403,
     * sans détail sur ses champs.
     */
    public function authorize(): bool
    {
        $product = $this->route('product');

        return ! $product instanceof Product || (bool) $this->user()?->can('update', $product);
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
