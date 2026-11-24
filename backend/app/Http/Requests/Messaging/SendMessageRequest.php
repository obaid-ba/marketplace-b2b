<?php

namespace App\Http\Requests\Messaging;

use Illuminate\Foundation\Http\FormRequest;

/** Envoyer un message, une pièce jointe, ou les deux (SCRUM-60). */
class SendMessageRequest extends FormRequest
{
    public const MAX_ATTACHMENT_KB = 10240;

    private const EXTENSIONS = 'pdf,jpg,jpeg,png,webp,doc,docx,xls,xlsx,csv,txt,zip';

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('body'))) {
            $this->merge(['body' => trim($this->input('body'))]);
        }
    }

    /**
     * L'extension et le type réel du contenu sont vérifiés tous les deux. Ni SVG ni HTML :
     * ils pourraient contenir du code exécuté par le navigateur.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'body' => ['nullable', 'required_without:attachment', 'string', 'max:5000'],
            'attachment' => [
                'nullable',
                'file',
                'extensions:'.self::EXTENSIONS,
                'mimes:'.self::EXTENSIONS,
                'max:'.self::MAX_ATTACHMENT_KB,
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'body.required_without' => 'Écrivez un message ou joignez un fichier.',
            'body.max' => 'Le message ne doit pas dépasser 5000 caractères.',
            'attachment.extensions' => 'Formats acceptés : PDF, images (JPG, PNG, WebP), Word, Excel, CSV, TXT, ZIP.',
            'attachment.mimes' => 'Formats acceptés : PDF, images (JPG, PNG, WebP), Word, Excel, CSV, TXT, ZIP.',
            'attachment.max' => 'La pièce jointe ne doit pas dépasser 10 Mo.',
            'attachment.uploaded' => "La pièce jointe n'a pas pu être envoyée (10 Mo maximum).",
        ];
    }
}
