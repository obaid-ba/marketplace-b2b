<?php

namespace App\Http\Requests\Messaging;

use App\Enums\ConversationContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Ouvrir une conversation depuis une demande, un devis, une commande ou une fiche (SCRUM-61). */
class OpenConversationRequest extends FormRequest
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
            'context_type' => ['required', Rule::enum(ConversationContext::class)],
            'context_id' => ['nullable', 'integer', Rule::requiredIf($this->input('context_type') !== ConversationContext::DIRECT->value)],
            'supplier_id' => ['nullable', 'integer', Rule::requiredIf($this->input('context_type') === ConversationContext::DIRECT->value)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'context_type.required' => 'Le contexte de la conversation est obligatoire.',
            'context_type.enum' => "Ce contexte de conversation n'existe pas.",
            'context_id.required' => "L'élément concerné est obligatoire.",
            'supplier_id.required' => 'Le fournisseur à contacter est obligatoire.',
        ];
    }
}
