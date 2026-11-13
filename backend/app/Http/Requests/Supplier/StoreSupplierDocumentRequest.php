<?php

namespace App\Http\Requests\Supplier;

use App\Models\SupplierDocument;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Ajout d'un document justificatif depuis le profil (SCRUM-28). Il arrive « en attente ».
 */
class StoreSupplierDocumentRequest extends FormRequest
{
    public const TYPES = [
        SupplierDocument::TYPE_COMMERCIAL_REGISTER,
        SupplierDocument::TYPE_TAX_CERTIFICATE,
        SupplierDocument::TYPE_MANAGER_ID,
        SupplierDocument::TYPE_CERTIFICATION,
    ];

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
            'type' => ['required', 'string', Rule::in(self::TYPES)],
            'file' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:5120'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'type.required' => 'Choisissez le type de document.',
            'type.in' => 'Le type de document est invalide.',
            'file.required' => 'Choisissez un fichier.',
            'file.file' => 'Le document doit être un fichier.',
            'file.mimes' => 'Le document doit être un PDF ou une image (JPG, PNG).',
            'file.max' => 'Le document ne doit pas dépasser 5 Mo.',
        ];
    }
}
