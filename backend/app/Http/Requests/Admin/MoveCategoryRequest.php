<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Réordonnancement d'une catégorie parmi ses sœurs (SCRUM-32) :
 * { "direction": "up" | "down" } (boutons ↑ ↓) ou { "position": 3 } (glisser-déposer).
 */
class MoveCategoryRequest extends FormRequest
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
            'direction' => ['required_without:position', 'nullable', 'in:up,down'],
            'position' => ['required_without:direction', 'nullable', 'integer', 'min:1'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'direction.required_without' => 'Indiquez un sens (haut ou bas) ou une position.',
            'direction.in' => 'Le sens doit être « up » ou « down ».',
            'position.required_without' => 'Indiquez un sens (haut ou bas) ou une position.',
            'position.integer' => 'La position doit être un nombre entier.',
            'position.min' => 'La position commence à 1.',
        ];
    }
}
