<?php

namespace App\Http\Requests\Supplier;

use App\Models\Product;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Création ou modification d'un produit / service par son fournisseur (SCRUM-33).
 * Les règles de publication (description et au moins une photo) sont vérifiées par ProductService,
 * car elles dépendent des photos déjà enregistrées.
 */
class SaveProductRequest extends FormRequest
{
    public const UNITS_MAX_LENGTH = 30;

    /**
     * Contrôle de propriété AVANT la validation (SCRUM-90) : le produit d'un autre fournisseur répond 403,
     * sans détail sur ses champs.
     */
    public function authorize(): bool
    {
        $product = $this->route('product');

        return ! $product instanceof Product || (bool) $this->user()?->can('update', $product);
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'title' => is_string($this->input('title')) ? trim($this->input('title')) : $this->input('title'),
            'description' => is_string($this->input('description')) ? trim($this->input('description')) : $this->input('description'),
            // Un service n'a pas de stock.
            'stock' => $this->input('type') === 'service' ? null : $this->input('stock'),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'type' => ['required', Rule::in(['product', 'service'])],
            'title' => ['required', 'string', 'max:150'],
            'category_id' => ['required', 'integer', 'exists:categories,id'],
            'description' => ['nullable', 'string', 'max:5000'],
            'price' => ['required', 'numeric', 'min:0', 'max:9999999999'],
            'unit' => ['required', 'string', 'max:'.self::UNITS_MAX_LENGTH],
            'stock' => ['nullable', 'required_if:type,product', 'integer', 'min:0', 'max:2000000000'],
            'availability_days' => ['required', 'integer', 'min:1', 'max:365'],
            'status' => ['required', Rule::in(array_keys(Product::API_STATUSES))],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'type.required' => 'Choisissez « Produit » ou « Service ».',
            'type.in' => 'Le type doit être « Produit » ou « Service ».',
            'title.required' => 'Le titre est obligatoire.',
            'title.max' => 'Le titre ne doit pas dépasser :max caractères.',
            'category_id.required' => 'Choisissez une catégorie.',
            'category_id.exists' => 'La catégorie choisie est introuvable.',
            'description.max' => 'La description ne doit pas dépasser :max caractères.',
            'price.required' => 'Le prix est obligatoire.',
            'price.numeric' => 'Le prix doit être un nombre.',
            'price.min' => 'Le prix ne peut pas être négatif.',
            'price.max' => 'Le prix est trop élevé.',
            'unit.required' => 'Choisissez une unité de vente.',
            'unit.max' => 'L\'unité ne doit pas dépasser :max caractères.',
            'stock.required_if' => 'Le stock est obligatoire pour un produit.',
            'stock.integer' => 'Le stock doit être un nombre entier.',
            'stock.min' => 'Le stock ne peut pas être négatif.',
            'availability_days.required' => 'Le délai de disponibilité est obligatoire.',
            'availability_days.integer' => 'Le délai doit être un nombre de jours.',
            'availability_days.min' => 'Le délai doit être d\'au moins 1 jour.',
            'availability_days.max' => 'Le délai ne doit pas dépasser :max jours.',
            'status.in' => 'Statut invalide.',
        ];
    }
}
