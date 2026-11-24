<?php

namespace App\Http\Requests\Dispute;

use App\Enums\DisputeDecision;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** Décision de l'administrateur : motif obligatoire, envoyé aux deux parties (ENTITIES.md, règle 9). */
class DecideDisputeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('note'))) {
            $this->merge(['note' => trim($this->input('note'))]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'decision' => ['required', Rule::enum(DisputeDecision::class)],
            'note' => ['required', 'string', 'min:10', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'decision.required' => 'Choisissez une décision.',
            'decision.enum' => "Cette décision n'existe pas.",
            'note.required' => 'Le motif de la décision est obligatoire.',
            'note.min' => 'Le motif doit contenir au moins 10 caractères.',
            'note.max' => 'Le motif ne doit pas dépasser 2000 caractères.',
        ];
    }
}
