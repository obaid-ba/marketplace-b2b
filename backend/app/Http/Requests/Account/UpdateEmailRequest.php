<?php

namespace App\Http\Requests\Account;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Changement d'adresse e-mail (SCRUM-27).
 * La nouvelle adresse doit être disponible ; elle repasse ensuite par la vérification
 * par e-mail avant de redonner accès aux espaces métier.
 */
class UpdateEmailRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'email' => is_string($this->input('email'))
                ? strtolower(trim($this->input('email')))
                : $this->input('email'),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $user = $this->user();

        return [
            'email' => [
                'required',
                'string',
                'email',
                'max:255',
                Rule::unique('users', 'email')->ignore($user?->getKey()),
                function (string $attribute, mixed $value, \Closure $fail) use ($user) {
                    if ($user && strtolower((string) $value) === strtolower($user->email)) {
                        $fail("C'est déjà votre adresse e-mail actuelle.");
                    }
                },
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'email.required' => 'La nouvelle adresse e-mail est obligatoire.',
            'email.email' => "L'adresse e-mail n'est pas valide.",
            'email.unique' => 'Un compte existe déjà avec cette adresse e-mail.',
            'email.max' => "L'adresse e-mail ne doit pas dépasser 255 caractères.",
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'email' => 'adresse e-mail',
        ];
    }
}
