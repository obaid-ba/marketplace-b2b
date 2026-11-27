<?php

namespace App\Http\Requests\Account;

use Illuminate\Validation\Rule;

/**
 * Mise à jour complète du compte (SCRUM-98) : nom, téléphone, informations du profil
 * et adresse e-mail. Réutilise les règles du profil ; l'e-mail peut rester inchangé
 * (dans ce cas aucune nouvelle vérification n'est demandée).
 */
class UpdateAccountRequest extends UpdateProfileRequest
{
    protected function prepareForValidation(): void
    {
        parent::prepareForValidation();

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
        $rules = parent::rules();
        $user = $this->user();

        $rules['email'] = [
            'required',
            'string',
            'email',
            'max:255',
            Rule::unique('users', 'email')->ignore($user?->getKey()),
        ];

        return $rules;
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return parent::messages() + [
            'email.required' => "L'adresse e-mail est obligatoire.",
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
        return parent::attributes() + [
            'email' => 'adresse e-mail',
        ];
    }
}
