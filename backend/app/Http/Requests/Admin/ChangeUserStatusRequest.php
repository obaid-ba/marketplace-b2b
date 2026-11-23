<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

/** Suspendre ou réactiver un compte : motif obligatoire, conservé dans le journal (SCRUM-118). */
class ChangeUserStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('reason'))) {
            $this->merge(['reason' => trim($this->input('reason'))]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return ['reason' => ['required', 'string', 'min:10', 'max:1000']];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'reason.required' => 'Le motif est obligatoire.',
            'reason.min' => 'Le motif doit contenir au moins 10 caractères.',
            'reason.max' => 'Le motif ne doit pas dépasser 1000 caractères.',
        ];
    }
}
