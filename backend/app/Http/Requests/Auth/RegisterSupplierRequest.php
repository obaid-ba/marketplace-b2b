<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

/**
 * Inscription d'un fournisseur en trois étapes (SCRUM-22).
 * L'étape 1 (compte) et l'étape 2 (entreprise) sont envoyées avec l'étape 3
 * (justificatifs) : l'assistant de saisie conserve les données côté navigateur.
 */
class RegisterSupplierRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'email' => is_string($this->input('email')) ? strtolower(trim($this->input('email'))) : $this->input('email'),
            'company_name' => is_string($this->input('company_name')) ? trim($this->input('company_name')) : $this->input('company_name'),
            'sector' => is_string($this->input('sector')) ? trim($this->input('sector')) : $this->input('sector'),
            'phone' => filled($this->input('phone')) ? trim((string) $this->input('phone')) : null,
            'contact' => filled($this->input('contact')) ? trim((string) $this->input('contact')) : null,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            // Étape 1 : compte
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users', 'email')],
            'password' => [
                'required',
                'string',
                'confirmed',
                Password::min(8)->letters()->mixedCase()->numbers(),
            ],

            // Étape 2 : entreprise
            'company_name' => ['required', 'string', 'max:255'],
            'sector' => ['required', 'string', 'max:255'],
            'region_id' => ['required', 'integer', 'exists:regions,id'],
            'coverage_regions' => ['required', 'array', 'min:1', 'max:24'],
            'coverage_regions.*' => ['required', 'integer', 'distinct', 'exists:regions,id'],
            'categories' => ['required', 'array', 'min:1', 'max:50'],
            'categories.*' => ['required', 'integer', 'distinct', 'exists:categories,id'],
            'description' => ['nullable', 'string', 'max:2000'],
            'phone' => ['nullable', 'string', 'max:30'],
            'contact' => ['nullable', 'string', 'max:255'],

            // Étape 3 : justificatifs
            'commercial_register' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:5120'],
            'certifications' => ['required', 'array', 'min:1', 'max:5'],
            'certifications.*' => ['file', 'mimes:pdf,jpg,jpeg,png', 'max:5120'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'email.required' => "L'adresse e-mail est obligatoire.",
            'email.email' => "L'adresse e-mail n'est pas valide.",
            'email.unique' => 'Un compte existe déjà avec cette adresse e-mail.',
            'password.required' => 'Le mot de passe est obligatoire.',
            'password.confirmed' => 'Les deux mots de passe ne correspondent pas.',
            'password.min' => 'Le mot de passe doit contenir au moins 8 caractères.',
            'password.letters' => 'Le mot de passe doit contenir au moins une lettre.',
            'password.mixed' => 'Le mot de passe doit contenir au moins une majuscule et une minuscule.',
            'password.numbers' => 'Le mot de passe doit contenir au moins un chiffre.',
            'company_name.required' => "Le nom de l'entreprise est obligatoire.",
            'sector.required' => 'Le secteur d’activité est obligatoire.',
            'region_id.required' => 'La région du siège est obligatoire.',
            'region_id.exists' => 'La région sélectionnée est invalide.',
            'coverage_regions.required' => 'Sélectionnez au moins une zone couverte.',
            'coverage_regions.min' => 'Sélectionnez au moins une zone couverte.',
            'coverage_regions.*.exists' => 'Une des zones couvertes est invalide.',
            'categories.required' => 'Sélectionnez au moins une catégorie proposée.',
            'categories.min' => 'Sélectionnez au moins une catégorie proposée.',
            'categories.*.exists' => 'Une des catégories sélectionnées est invalide.',
            'commercial_register.required' => 'Le registre de commerce est obligatoire.',
            'commercial_register.file' => 'Le registre de commerce doit être un fichier.',
            'commercial_register.mimes' => 'Le registre de commerce doit être un PDF ou une image (JPG, PNG).',
            'commercial_register.max' => 'Le registre de commerce ne doit pas dépasser 5 Mo.',
            'certifications.required' => 'Ajoutez au moins une certification.',
            'certifications.min' => 'Ajoutez au moins une certification.',
            'certifications.max' => 'Vous pouvez ajouter au plus 5 certifications.',
            'certifications.*.file' => 'Chaque certification doit être un fichier.',
            'certifications.*.mimes' => 'Les certifications doivent être des PDF ou des images (JPG, PNG).',
            'certifications.*.max' => 'Chaque certification ne doit pas dépasser 5 Mo.',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'email' => 'adresse e-mail',
            'password' => 'mot de passe',
            'company_name' => "nom de l'entreprise",
            'sector' => 'secteur d’activité',
            'region_id' => 'région du siège',
            'coverage_regions' => 'zones couvertes',
            'categories' => 'catégories proposées',
            'commercial_register' => 'registre de commerce',
            'certifications' => 'certifications',
        ];
    }
}
