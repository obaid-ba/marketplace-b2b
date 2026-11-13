<?php

namespace App\Http\Requests\Account;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Hash;

/**
 * Confirmation par mot de passe avant une action irréversible sur le compte
 * (désactivation ou suppression, SCRUM-30).
 * Le mot de passe n'est jamais renvoyé dans la réponse d'erreur : seul un
 * message générique est affiché.
 */
class ConfirmAccountPasswordRequest extends FormRequest
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
            'password' => [
                'required',
                'string',
                function (string $attribute, mixed $value, \Closure $fail) {
                    $user = $this->user();

                    if (! $user || ! Hash::check((string) $value, $user->password)) {
                        $fail('Le mot de passe est incorrect.');
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
            'password.required' => 'Saisissez votre mot de passe pour confirmer.',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'password' => 'mot de passe',
        ];
    }
}
