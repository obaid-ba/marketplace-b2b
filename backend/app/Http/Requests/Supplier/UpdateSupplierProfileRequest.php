<?php

namespace App\Http\Requests\Supplier;

use App\Enums\SupplierSector;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Mise à jour du profil de l'entreprise (SCRUM-28).
 * Seuls les champs listés ici sont acceptés : validation_status, is_published,
 * rating_avg, reviews_count ou user_id envoyés dans la requête sont ignorés.
 */
class UpdateSupplierProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Rôle vérifié par le middleware, propriété par la policy (contrôleur).
    }

    protected function prepareForValidation(): void
    {
        $text = fn (string $field) => is_string($this->input($field)) ? trim($this->input($field)) : $this->input($field);
        $email = $text('professional_email');

        $this->merge([
            'company_name' => $text('company_name'),
            'description' => filled($this->input('description')) ? $text('description') : null,
            'sector' => $text('sector'),
            'professional_phone' => $this->normalizePhone($this->input('professional_phone')),
            'professional_email' => is_string($email) && $email !== '' ? strtolower($email) : null,
        ]);
    }

    /**
     * Téléphone tunisien : 8 chiffres, avec ou sans l'indicatif +216 (même format qu'à l'inscription).
     */
    private function normalizePhone(mixed $phone): mixed
    {
        if (! is_string($phone)) {
            return $phone;
        }

        $digits = preg_replace('/\D/', '', $phone);

        if (strlen($digits) === 11 && str_starts_with($digits, '216')) {
            $digits = substr($digits, 3);
        }

        return $digits === '' ? null : '+216 '.$digits;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        // Un secteur saisi librement avant la liste fixe (inscription) reste accepté tant qu'il n'est pas changé.
        $sectors = SupplierSector::values();
        $current = $this->user()?->supplierProfile?->sector;
        if (filled($current)) {
            $sectors[] = $current;
        }

        return [
            'company_name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'sector' => ['required', 'string', Rule::in($sectors)],
            'region_id' => ['required', 'integer', 'exists:regions,id'],
            'professional_phone' => ['nullable', 'string', 'regex:/^\+216 \d{8}$/'],
            'professional_email' => ['nullable', 'string', 'email', 'max:255'],
            'categories' => ['required', 'array', 'min:1', 'max:50'],
            'categories.*' => ['required', 'integer', 'distinct', 'exists:categories,id'],
            'coverage_regions' => ['required', 'array', 'min:1', 'max:24'],
            'coverage_regions.*' => ['required', 'integer', 'distinct', 'exists:regions,id'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'company_name.required' => "Le nom de l'entreprise est obligatoire.",
            'company_name.max' => "Le nom de l'entreprise ne doit pas dépasser 255 caractères.",
            'description.max' => 'La description ne doit pas dépasser 2000 caractères.',
            'sector.required' => 'Le secteur est obligatoire.',
            'sector.in' => 'Choisissez un secteur dans la liste.',
            'region_id.required' => 'Le gouvernorat est obligatoire.',
            'region_id.exists' => 'Le gouvernorat sélectionné est invalide.',
            'professional_phone.regex' => 'Le téléphone doit contenir 8 chiffres (préfixe +216).',
            'professional_email.email' => "L'adresse e-mail n'est pas valide.",
            'categories.required' => 'Ajoutez au moins une catégorie proposée.',
            'categories.min' => 'Ajoutez au moins une catégorie proposée.',
            'categories.*.exists' => 'Une des catégories est invalide.',
            'categories.*.distinct' => 'Une catégorie est en double.',
            'coverage_regions.required' => 'Cochez au moins une zone couverte.',
            'coverage_regions.min' => 'Cochez au moins une zone couverte.',
            'coverage_regions.*.exists' => 'Une des zones couvertes est invalide.',
            'coverage_regions.*.distinct' => 'Une zone couverte est en double.',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'company_name' => "nom de l'entreprise",
            'description' => 'description',
            'sector' => 'secteur',
            'region_id' => 'gouvernorat',
            'professional_phone' => 'téléphone',
            'professional_email' => 'adresse e-mail',
            'categories' => 'catégories proposées',
            'coverage_regions' => 'zones couvertes',
        ];
    }
}
