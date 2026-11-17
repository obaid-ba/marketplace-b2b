<?php

namespace App\Http\Requests\Catalog;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Paramètres du catalogue public (SCRUM-35), tels qu'ils apparaissent dans l'URL :
 * ?q=carton&category=3,5&type=product&region=12&price_min=0&price_max=5000&delay=7&rating=4&sort=price_asc&page=2
 * Les listes (category, type, region) acceptent « 3,5 » ou un tableau.
 */
class SearchProductsRequest extends FormRequest
{
    public const SORTS = ['relevance', 'price_asc', 'price_desc', 'rating', 'newest'];

    public const DEFAULT_PER_PAGE = 12;

    public const MAX_PER_PAGE = 48;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $lists = [];
        foreach (['category', 'type', 'region'] as $key) {
            $value = $this->input($key);
            if (is_string($value)) {
                $lists[$key] = array_values(array_filter(array_map('trim', explode(',', $value)), fn ($v) => $v !== ''));
            }
        }

        if (is_string($this->input('q'))) {
            $lists['q'] = trim($this->input('q'));
        }

        $this->merge($lists);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'q' => ['nullable', 'string', 'max:100'],
            'category' => ['nullable', 'array', 'max:50'],
            'category.*' => ['integer', 'min:1'],
            'type' => ['nullable', 'array'],
            'type.*' => ['in:product,service'],
            'region' => ['nullable', 'array', 'max:24'],
            'region.*' => ['integer', 'min:1'],
            'price_min' => ['nullable', 'numeric', 'min:0'],
            'price_max' => array_filter([
                'nullable', 'numeric', 'min:0',
                is_numeric($this->input('price_min')) ? 'gte:price_min' : null,
            ]),
            'delay' => ['nullable', 'integer', 'min:1', 'max:365'],
            'rating' => ['nullable', 'numeric', 'min:1', 'max:5'],
            'sort' => ['nullable', 'in:'.implode(',', self::SORTS)],
            'supplier_id' => ['nullable', 'integer', 'min:1'],
            'exclude' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:'.self::MAX_PER_PAGE],
            'page' => ['nullable', 'integer', 'min:1'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'q.max' => 'La recherche ne doit pas dépasser :max caractères.',
            'category.*.integer' => 'Catégorie invalide.',
            'type.*.in' => 'Le type doit être « product » ou « service ».',
            'region.*.integer' => 'Région invalide.',
            'price_min.numeric' => 'Le prix minimum doit être un nombre.',
            'price_min.min' => 'Le prix minimum ne peut pas être négatif.',
            'price_max.numeric' => 'Le prix maximum doit être un nombre.',
            'price_max.min' => 'Le prix maximum ne peut pas être négatif.',
            'price_max.gte' => 'Le prix maximum doit être supérieur ou égal au prix minimum.',
            'delay.integer' => 'Le délai doit être un nombre de jours.',
            'delay.min' => 'Le délai doit être d\'au moins 1 jour.',
            'rating.numeric' => 'La note doit être un nombre.',
            'rating.min' => 'La note minimale est 1.',
            'rating.max' => 'La note maximale est 5.',
            'sort.in' => 'Tri inconnu.',
            'per_page.max' => 'Au plus :max résultats par page.',
        ];
    }
}
