<?php

namespace App\Http\Controllers\Api\Supplier;

use App\Enums\ValidationStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Supplier\StoreSupplierDocumentRequest;
use App\Http\Resources\SupplierDocumentResource;
use App\Models\SupplierDocument;
use App\Services\SupplierProfileService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Documents justificatifs depuis le profil de l'entreprise (SCRUM-28)
 * et renvoi de documents après un refus (SCRUM-27).
 */
class SupplierDocumentController extends Controller
{
    public function __construct(private readonly SupplierProfileService $service) {}

    public function store(StoreSupplierDocumentRequest $request): JsonResponse
    {
        $profile = $request->user()->supplierProfile;
        abort_if($profile === null, 404, 'Profil fournisseur introuvable.');
        Gate::authorize('update', $profile);

        $wasRejected = $profile->validation_status === ValidationStatus::REJECTED;

        $document = $this->service->addDocument(
            $profile,
            $request->string('type')->toString(),
            $request->file('file'),
        );

        return response()->json([
            'message' => $wasRejected
                ? "Document envoyé. Votre dossier repasse en cours d'examen."
                : 'Document ajouté. Il sera vérifié par un administrateur.',
            'document' => new SupplierDocumentResource($document),
            // Dossier refusé : repasse « en attente » après l'envoi (SCRUM-27).
            'validation_status' => $profile->validation_status->value,
        ], 201);
    }

    /**
     * Téléchargement d'un justificatif (stocké sur le disque privé).
     */
    public function download(SupplierDocument $document): StreamedResponse
    {
        Gate::authorize('view', $document);

        $disk = Storage::disk(SupplierProfileService::DOCUMENT_DISK);
        abort_unless($disk->exists($document->file_path), 404, 'Fichier introuvable.');

        return $disk->download($document->file_path, SupplierDocumentResource::fileNameFor($document));
    }
}
