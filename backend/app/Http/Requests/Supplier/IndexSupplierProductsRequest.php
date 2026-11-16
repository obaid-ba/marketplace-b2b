<?php

namespace App\Http\Requests\Supplier;

use App\Models\Product;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Filtres de « Mes produits » (SCRUM-34) : ?status=published&category_id=3&page=2
 */
class IndexSupplierProductsRequest extends FormRequest
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
            'status' => ['nullable', Rule::in(array_keys(Product::API_STATUSES))],
            'category_id' => ['nullable', 'integer', 'min:1'],
            'page' => ['nullable', 'integer', 'min:1'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'status.in' => 'Statut inconnu.',
            'category_id.integer' => 'Catégorie invalide.',
        ];
    }
}
