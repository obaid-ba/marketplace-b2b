<?php

namespace App\Http\Requests\Dispute;

use App\Enums\DisputeReason;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/** « Signaler un problème » sur une commande (SCRUM-117 / F23). */
class OpenDisputeRequest extends FormRequest
{
    public const MAX_FILES = 5;

    public const MAX_FILE_KB = 5120;

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('description'))) {
            $this->merge(['description' => trim($this->input('description'))]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'reason' => ['required', Rule::enum(DisputeReason::class)],
            'description' => ['required', 'string', 'min:20', 'max:3000'],
            'attachments' => ['nullable', 'array', 'max:'.self::MAX_FILES],
            'attachments.*' => ['file', 'extensions:jpg,jpeg,png,webp,pdf', 'mimes:jpg,jpeg,png,webp,pdf', 'max:'.self::MAX_FILE_KB],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'reason.required' => 'Choisissez le motif du problème.',
            'reason.enum' => "Ce motif n'existe pas.",
            'description.required' => 'Décrivez le problème rencontré.',
            'description.min' => 'Décrivez le problème en 20 caractères au moins.',
            'description.max' => 'La description ne doit pas dépasser 3000 caractères.',
            'attachments.max' => 'Cinq fichiers au maximum.',
            'attachments.*.extensions' => 'Formats acceptés : JPG, PNG, WebP et PDF.',
            'attachments.*.mimes' => 'Formats acceptés : JPG, PNG, WebP et PDF.',
            'attachments.*.max' => 'Chaque fichier doit faire 5 Mo au maximum.',
            'attachments.*.uploaded' => "Un fichier n'a pas pu être envoyé (5 Mo maximum par fichier).",
        ];
    }
}
