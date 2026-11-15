<?php

namespace App\Http\Resources;

use App\Models\SupplierDocument;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin SupplierDocument
 */
class SupplierDocumentResource extends JsonResource
{
    public const TYPE_LABELS = [
        SupplierDocument::TYPE_COMMERCIAL_REGISTER => 'Registre de commerce',
        SupplierDocument::TYPE_TAX_CERTIFICATE => 'Attestation fiscale',
        SupplierDocument::TYPE_MANAGER_ID => 'CIN du gérant',
        SupplierDocument::TYPE_CERTIFICATION => 'Certification',
    ];

    /**
     * Nom affiché et proposé au téléchargement (le nom d'origine du fichier n'est pas conservé).
     */
    public static function fileNameFor(SupplierDocument $document): string
    {
        $label = self::TYPE_LABELS[$document->type] ?? ucfirst($document->type);
        $extension = pathinfo($document->file_path, PATHINFO_EXTENSION);

        return $extension ? "{$label}.{$extension}" : $label;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type,
            'type_label' => self::TYPE_LABELS[$this->type] ?? ucfirst($this->type),
            'file_name' => self::fileNameFor($this->resource),
            'status' => $this->status->value,
            'submitted_at' => $this->submitted_at?->toIso8601String(),
        ];
    }
}
