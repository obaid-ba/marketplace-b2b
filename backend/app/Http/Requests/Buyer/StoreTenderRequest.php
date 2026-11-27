<?php

namespace App\Http\Requests\Buyer;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Publication d'une demande (SCRUM-41 / F11).
 * Les pièces jointes sont optionnelles ; la date limite doit être future.
 */
class StoreTenderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Rôle vérifié par le middleware.
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'title' => is_string($this->input('title')) ? trim($this->input('title')) : $this->input('title'),
            'description' => is_string($this->input('description')) ? trim($this->input('description')) : $this->input('description'),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'min:5', 'max:150'],
            'description' => ['required', 'string', 'min:20', 'max:5000'],
            'category_id' => ['required', 'integer', 'exists:categories,id'],
            'region_id' => ['nullable', 'integer', 'exists:regions,id'],
            'budget' => ['nullable', 'numeric', 'min:0', 'max:9999999999'],
            'desired_deadline' => ['nullable', 'date', 'after:today'],
            'attachments' => ['nullable', 'array', 'max:5'],
            'attachments.*' => ['file', 'mimes:pdf,jpg,jpeg,png,doc,docx', 'max:5120'],
            // Analyse IA utilisée et fournisseurs suggérés cochés par le porteur (SCRUM-81).
            'ai_interaction_id' => ['nullable', 'integer'],
            'suggested_supplier_ids' => ['nullable', 'array', 'max:10'],
            'suggested_supplier_ids.*' => ['integer', 'distinct'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'title.required' => 'Le titre de la demande est obligatoire.',
            'title.min' => 'Le titre doit contenir au moins 5 caractères.',
            'description.required' => 'La description du besoin est obligatoire.',
            'description.min' => 'Décrivez votre besoin en au moins 20 caractères.',
            'category_id.required' => 'Choisissez une catégorie.',
            'category_id.exists' => 'Cette catégorie n’existe pas.',
            'region_id.exists' => 'Cette région n’existe pas.',
            'budget.numeric' => 'Le budget doit être un montant.',
            'budget.min' => 'Le budget ne peut pas être négatif.',
            'desired_deadline.after' => 'La date limite doit être postérieure à aujourd’hui.',
            'attachments.max' => 'Vous pouvez joindre au maximum 5 fichiers.',
            'attachments.*.mimes' => 'Formats acceptés : PDF, JPG, PNG, DOC ou DOCX.',
            'attachments.*.max' => 'Chaque fichier doit faire moins de 5 Mo.',
        ];
    }
}
