<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

/**
 * Inscription d'un fournisseur en trois étapes (SCRUM-22).
 * L'étape 1 (compte) et l'étape 2 (entreprise) sont envoyées avec l'étape 3
 * (justificatifs) : l'assistant de saisie conserve les données côté navigateur.
 * Champs alignés sur docs/ENTITIES.md (obligatoires à l'inscription).
 */
class RegisterSupplierRequest extends FormRequest
{
    public const LEGAL_FORMS = [
        'personne physique',
        'SARL',
        'SUARL',
        'SA',
        'auto-entrepreneur',
        'coopérative',
    ];

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $text = fn (string $field) => is_string($this->input($field))
            ? trim($this->input($field))
            : $this->input($field);

        $this->merge([
            'email' => is_string($this->input('email')) ? strtolower(trim($this->input('email'))) : $this->input('email'),
            'first_name' => $text('first_name'),
            'last_name' => $text('last_name'),
            'phone' => $this->normalizePhone($this->input('phone')),
            'company_name' => $text('company_name'),
            'legal_form' => $text('legal_form'),
            'tax_id' => $text('tax_id'),
            'rne_number' => $text('rne_number'),
            'sector' => $text('sector'),
            'address' => $text('address'),
            'city' => $text('city'),
            'contact_name' => $text('contact_name'),
            'contact_role' => $text('contact_role'),
            'contact_phone' => $text('contact_phone'),
            'contact' => filled($this->input('contact')) ? trim((string) $this->input('contact')) : null,
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
            // Étape 1 : compte
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

            // Étape 2 : entreprise
            'company_name' => ['required', 'string', 'max:255'],
            'legal_form' => ['required', 'string', Rule::in(self::LEGAL_FORMS)],
            'tax_id' => ['required', 'string', 'max:20', Rule::unique('supplier_profiles', 'tax_id')],
            'rne_number' => ['required', 'string', 'max:30', Rule::unique('supplier_profiles', 'rne_number')],
            'sector' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string', 'max:2000'],
            'region_id' => ['required', 'integer', 'exists:regions,id'],
            'address' => ['required', 'string', 'max:255'],
            'city' => ['required', 'string', 'max:255'],
            'contact_name' => ['required', 'string', 'max:255'],
            'contact_role' => ['required', 'string', 'max:255'],
            'contact_phone' => ['required', 'string', 'max:30'],
            'coverage_regions' => ['required', 'array', 'min:1', 'max:24'],
            'coverage_regions.*' => ['required', 'integer', 'distinct', 'exists:regions,id'],
            'categories' => ['required', 'array', 'min:1', 'max:50'],
            'categories.*' => ['required', 'integer', 'distinct', 'exists:categories,id'],
            'contact' => ['nullable', 'string', 'max:255'],

            // Étape 3 : justificatifs
            'commercial_register' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:5120'],
            'tax_certificate' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:5120'],
            'manager_id' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:5120'],
            'certifications' => ['nullable', 'array', 'max:5'],
            'certifications.*' => ['file', 'mimes:pdf,jpg,jpeg,png', 'max:5120'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'first_name.required' => 'Le prénom est obligatoire.',
            'last_name.required' => 'Le nom est obligatoire.',
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
            'company_name.required' => "Le nom de l'entreprise est obligatoire.",
            'legal_form.required' => 'La forme juridique est obligatoire.',
            'legal_form.in' => 'La forme juridique sélectionnée est invalide.',
            'tax_id.required' => 'Le matricule fiscal est obligatoire.',
            'tax_id.unique' => 'Un fournisseur utilise déjà ce matricule fiscal.',
            'rne_number.required' => 'Le numéro RNE est obligatoire.',
            'rne_number.unique' => 'Un fournisseur utilise déjà ce numéro RNE.',
            'sector.required' => 'Le secteur d’activité est obligatoire.',
            'description.required' => "La description de l'entreprise est obligatoire.",
            'region_id.required' => 'La région du siège est obligatoire.',
            'region_id.exists' => 'La région sélectionnée est invalide.',
            'address.required' => "L'adresse est obligatoire.",
            'city.required' => 'La ville (délégation) est obligatoire.',
            'contact_name.required' => 'Le nom de la personne de contact est obligatoire.',
            'contact_role.required' => 'La fonction de la personne de contact est obligatoire.',
            'contact_phone.required' => 'Le téléphone de la personne de contact est obligatoire.',
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
            'tax_certificate.required' => "L'attestation fiscale est obligatoire.",
            'tax_certificate.file' => "L'attestation fiscale doit être un fichier.",
            'tax_certificate.mimes' => "L'attestation fiscale doit être un PDF ou une image (JPG, PNG).",
            'tax_certificate.max' => "L'attestation fiscale ne doit pas dépasser 5 Mo.",
            'manager_id.required' => 'La CIN du gérant est obligatoire.',
            'manager_id.file' => 'La CIN du gérant doit être un fichier.',
            'manager_id.mimes' => 'La CIN du gérant doit être un PDF ou une image (JPG, PNG).',
            'manager_id.max' => 'La CIN du gérant ne doit pas dépasser 5 Mo.',
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
            'first_name' => 'prénom',
            'last_name' => 'nom',
            'email' => 'adresse e-mail',
            'phone' => 'téléphone',
            'password' => 'mot de passe',
            'company_name' => "nom de l'entreprise",
            'legal_form' => 'forme juridique',
            'tax_id' => 'matricule fiscal',
            'rne_number' => 'numéro RNE',
            'sector' => 'secteur d’activité',
            'description' => "description de l'entreprise",
            'region_id' => 'région du siège',
            'address' => 'adresse',
            'city' => 'ville',
            'contact_name' => 'nom du contact',
            'contact_role' => 'fonction du contact',
            'contact_phone' => 'téléphone du contact',
            'coverage_regions' => 'zones couvertes',
            'categories' => 'catégories proposées',
            'commercial_register' => 'registre de commerce',
            'tax_certificate' => 'attestation fiscale',
            'manager_id' => 'CIN du gérant',
            'certifications' => 'certifications',
        ];
    }
}
