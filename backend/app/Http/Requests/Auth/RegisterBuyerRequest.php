<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

/**
 * Inscription d'un porteur de projet (SCRUM-23).
 * Champs obligatoires de docs/ENTITIES.md : compte (nom, prénom, e-mail, téléphone,
 * mot de passe) et profil (type de porteur, organisation, secteur, région, CGU).
 * Les champs optionnels (fonction, CIN, adresse…) se complètent dans le profil.
 */
class RegisterBuyerRequest extends FormRequest
{
    public const BUYER_TYPES = ['individu', 'startup', 'entreprise', 'association', 'institution'];

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'email' => is_string($this->input('email')) ? strtolower(trim($this->input('email'))) : $this->input('email'),
            'first_name' => is_string($this->input('first_name')) ? trim($this->input('first_name')) : $this->input('first_name'),
            'last_name' => is_string($this->input('last_name')) ? trim($this->input('last_name')) : $this->input('last_name'),
            'phone' => $this->normalizePhone($this->input('phone')),
            'organization' => is_string($this->input('organization')) ? trim($this->input('organization')) : $this->input('organization'),
            'sector' => is_string($this->input('sector')) ? trim($this->input('sector')) : $this->input('sector'),
        ]);
    }

    /**
     * Téléphone tunisien : 8 chiffres, avec ou sans l'indicatif +216.
     */
    private function normalizePhone(mixed $phone): mixed
    {
        if (! is_string($phone)) {
            return $phone;
        }

        $digits = preg_replace('/\D/', '', $phone);

        if (str_starts_with($digits, '216')) {
            $digits = substr($digits, 3);
        }

        return $digits === '' ? null : '+216 '.$digits;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users', 'email')],
            'phone' => ['required', 'string', 'regex:/^\+216 \d{8}$/'],
            'password' => [
                'required',
                'string',
                'confirmed',
                Password::min(8)->letters()->mixedCase()->numbers(),
            ],
            'buyer_type' => ['required', 'string', Rule::in(self::BUYER_TYPES)],
            'organization' => ['required', 'string', 'max:255'],
            'sector' => ['required', 'string', 'max:255'],
            'region_id' => ['required', 'integer', 'exists:regions,id'],
            'terms_accepted' => ['required', 'accepted'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'first_name.required' => 'Le prénom est obligatoire.',
            'first_name.max' => 'Le prénom ne doit pas dépasser 255 caractères.',
            'last_name.required' => 'Le nom est obligatoire.',
            'last_name.max' => 'Le nom ne doit pas dépasser 255 caractères.',
            'email.required' => "L'adresse e-mail est obligatoire.",
            'email.email' => "L'adresse e-mail n'est pas valide.",
            'email.unique' => 'Un compte existe déjà avec cette adresse e-mail.',
            'phone.required' => 'Le téléphone est obligatoire.',
            'phone.regex' => 'Le téléphone doit contenir 8 chiffres (préfixe +216).',
            'password.required' => 'Le mot de passe est obligatoire.',
            'password.confirmed' => 'Les deux mots de passe ne correspondent pas.',
            'password.min' => 'Le mot de passe doit contenir au moins 8 caractères.',
            'password.letters' => 'Le mot de passe doit contenir au moins une lettre.',
            'password.mixed' => 'Le mot de passe doit contenir au moins une majuscule et une minuscule.',
            'password.numbers' => 'Le mot de passe doit contenir au moins un chiffre.',
            'buyer_type.required' => 'Le type de porteur est obligatoire.',
            'buyer_type.in' => 'Le type de porteur sélectionné est invalide.',
            'organization.required' => "L'organisation ou le projet représenté est obligatoire.",
            'organization.max' => "L'organisation ne doit pas dépasser 255 caractères.",
            'sector.required' => "Le secteur d'activité est obligatoire.",
            'sector.max' => 'Le secteur ne doit pas dépasser 255 caractères.',
            'region_id.required' => 'La région est obligatoire.',
            'region_id.exists' => 'La région sélectionnée est invalide.',
            'terms_accepted.required' => "Vous devez accepter les conditions d'utilisation.",
            'terms_accepted.accepted' => "Vous devez accepter les conditions d'utilisation.",
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'first_name' => 'prénom',
            'last_name' => 'nom',
            'email' => 'adresse e-mail',
            'phone' => 'téléphone',
            'password' => 'mot de passe',
            'buyer_type' => 'type de porteur',
            'organization' => 'organisation ou projet',
            'sector' => "secteur d'activité",
            'region_id' => 'région',
        ];
    }
}
