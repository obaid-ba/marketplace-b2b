<?php

namespace App\Http\Controllers\Api\Supplier;

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
 * Documents justificatifs depuis le profil de l'entreprise (SCRUM-28).
 */
class SupplierDocumentController extends Controller
{
    public function __construct(private readonly SupplierProfileService $service) {}

    public function store(StoreSupplierDocumentRequest $request): JsonResponse
    {
        $profile = $request->user()->supplierProfile;
        abort_if($profile === null, 404, 'Profil fournisseur introuvable.');
        Gate::authorize('update', $profile);

        $document = $this->service->addDocument(
            $profile,
            $request->string('type')->toString(),
            $request->file('file'),
        );

        return response()->json([
            'message' => 'Document ajouté. Il sera vérifié par un administrateur.',
            'document' => new SupplierDocumentResource($document),
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
