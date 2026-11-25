<?php

namespace App\Http\Requests\Supplier;

use App\Models\Product;
use App\Services\ProductService;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Ajout de photos à un produit (SCRUM-33) : JPG, PNG ou WebP, 3 Mo maximum, 4 photos au total.
 */
class StoreProductImagesRequest extends FormRequest
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
            'images' => ['required', 'array', 'min:1', 'max:'.ProductService::MAX_IMAGES],
            'images.*' => ['required', 'file', 'image', 'mimes:jpg,jpeg,png,webp', 'max:'.ProductService::MAX_IMAGE_KB],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'images.required' => 'Choisissez au moins une image.',
            'images.max' => 'Un produit compte au plus :max photos.',
            'images.*.image' => 'Chaque fichier doit être une image (JPG, PNG ou WebP).',
            'images.*.mimes' => 'Chaque fichier doit être une image (JPG, PNG ou WebP).',
            'images.*.max' => 'Chaque image doit peser au plus 3 Mo.',
        ];
    }
}
