<?php

namespace App\Http\Requests\Account;

use App\Enums\UserRole;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Modification des informations personnelles (SCRUM-27).
 * Le nom et le téléphone sont communs à tous les rôles ; l'organisation et le secteur
 * ne concernent que le porteur de projet (BuyerProfile).
 */
class UpdateProfileRequest extends FormRequest
{
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
            'first_name' => $text('first_name'),
            'last_name' => $text('last_name'),
            'phone' => $this->normalizePhone($this->input('phone')),
            'organization' => $text('organization'),
            'sector' => $text('sector'),
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
        $rules = [
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'regex:/^\+216 \d{8}$/'],
        ];

        if ($this->user()?->role === UserRole::Buyer) {
            $rules['organization'] = ['required', 'string', 'max:255'];
            $rules['sector'] = ['required', 'string', 'max:255'];
        }

        return $rules;
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
            'phone.required' => 'Le téléphone est obligatoire.',
            'phone.regex' => 'Le téléphone doit contenir 8 chiffres (préfixe +216).',
            'organization.required' => "L'organisation ou le projet représenté est obligatoire.",
            'organization.max' => "L'organisation ne doit pas dépasser 255 caractères.",
            'sector.required' => "Le secteur d'activité est obligatoire.",
            'sector.max' => 'Le secteur ne doit pas dépasser 255 caractères.',
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
            'phone' => 'téléphone',
            'organization' => 'organisation ou projet',
            'sector' => "secteur d'activité",
        ];
    }
}
