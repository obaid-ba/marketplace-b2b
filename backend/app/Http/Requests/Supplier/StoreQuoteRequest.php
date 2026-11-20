<?php

namespace App\Http\Requests\Supplier;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Envoi ou mise à jour d'un devis (SCRUM-45).
 * Le montant et le délai sont obligatoires ; le devis reste unique par demande.
 */
class StoreQuoteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Rôle et destinataire vérifiés dans le service.
    }

    protected function prepareForValidation(): void
    {
        foreach (['conditions', 'comment'] as $field) {
            if (is_string($this->input($field))) {
                $this->merge([$field => trim($this->input($field))]);
            }
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'amount' => ['required', 'numeric', 'min:0.01', 'max:9999999999'],
            'delivery_days' => ['required', 'integer', 'min:1', 'max:365'],
            'conditions' => ['nullable', 'string', 'max:2000'],
            'comment' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'amount.required' => 'Indiquez le montant de votre devis.',
            'amount.min' => 'Le montant doit être supérieur à zéro.',
            'delivery_days.required' => 'Indiquez le délai de livraison.',
            'delivery_days.min' => 'Le délai doit être d’au moins un jour.',
            'delivery_days.max' => 'Le délai ne peut pas dépasser 365 jours.',
        ];
    }
}
