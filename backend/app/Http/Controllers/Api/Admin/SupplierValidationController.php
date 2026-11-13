<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\ValidationStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\SupplierDocumentResource;
use App\Models\AuditLog;
use App\Models\SupplierDocument;
use App\Models\SupplierProfile;
use App\Notifications\SupplierValidationNotification;
use App\Services\SupplierProfileService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SupplierValidationController extends Controller
{
    /**
     * File des demandes fournisseurs, triée de la plus ancienne à la plus récente (SCRUM-31).
     */
    public function index(Request $request): JsonResponse
    {
        $statusParam = $request->query('status', ValidationStatus::PENDING->value);

        $statusFilter = match ($statusParam) {
            'pending', ValidationStatus::PENDING->value => ValidationStatus::PENDING->value,
            'validated', ValidationStatus::VALIDATED->value => ValidationStatus::VALIDATED->value,
            'rejected', ValidationStatus::REJECTED->value => ValidationStatus::REJECTED->value,
            'all', 'tous' => null,
            default => ValidationStatus::PENDING->value,
        };

        $perPage = max(1, min(100, (int) $request->query('per_page', 15)));

        $suppliers = SupplierProfile::query()
            ->with([
                'user:id,name,email,phone,status,created_at',
                'region:id,name',
                'categories:id,name',
                'coverageRegions:id,name',
                'documents',
                'validator:id,name,email',
            ])
            ->when($statusFilter !== null, function ($query) use ($statusFilter) {
                $query->where('validation_status', $statusFilter);
            })
            ->orderBy('created_at', 'asc') // De la plus ancienne à la plus récente
            ->paginate($perPage);

        return response()->json($suppliers);
    }

    /**
     * Consultation détaillée du dossier d'un fournisseur et de ses documents envoyés.
     */
    public function show(SupplierProfile $supplier): JsonResponse
    {
        $supplier->load([
            'user:id,name,email,phone,status,created_at',
            'region:id,name',
            'categories:id,name',
            'coverageRegions:id,name',
            'documents',
            'validator:id,name,email',
        ]);

        return response()->json([
            'supplier' => $supplier,
        ]);
    }

    /**
     * Consultation / téléchargement d'un document justificatif envoyé par un fournisseur.
     */
    public function downloadDocument(SupplierDocument $document): StreamedResponse|JsonResponse
    {
        Gate::authorize('view', $document);

        foreach ([SupplierProfileService::DOCUMENT_DISK, 'public'] as $disk) {
            if (Storage::disk($disk)->exists($document->file_path)) {
                return Storage::disk($disk)->response(
                    $document->file_path,
                    SupplierDocumentResource::fileNameFor($document)
                );
            }
        }

        return response()->json([
            'message' => 'Le fichier demandé est introuvable sur le serveur.',
        ], 404);
    }

    /**
     * Accepter le dossier d'un fournisseur, notifier le fournisseur et tracer dans AuditLog.
     */
    public function approve(Request $request, SupplierProfile $supplier): JsonResponse
    {
        DB::transaction(function () use ($request, $supplier) {
            $supplier->update([
                'validation_status' => ValidationStatus::VALIDATED,
                'is_published' => true,
                'rejection_reason' => null,
                'validated_by' => $request->user()->id,
                'validated_at' => now(),
            ]);

            $supplier->documents()->update([
                'status' => ValidationStatus::VALIDATED->value,
            ]);

            AuditLog::create([
                'admin_id' => $request->user()->id,
                'action' => 'supplier.validated',
                'target' => "supplier_profile:{$supplier->id}",
                'reason' => null,
            ]);
        });

        $supplier->load(['user', 'documents', 'validator:id,name,email']);

        if ($supplier->user) {
            $supplier->user->notify(new SupplierValidationNotification(
                $supplier,
                ValidationStatus::VALIDATED
            ));
        }

        return response()->json([
            'message' => 'Le dossier fournisseur a été validé avec succès.',
            'supplier' => $supplier,
        ]);
    }

    /**
     * Refuser le dossier d'un fournisseur avec motif obligatoire, notifier et tracer dans AuditLog.
     */
    public function reject(Request $request, SupplierProfile $supplier): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:5', 'max:1000'],
        ], [
            'reason.required' => 'Le motif du refus est obligatoire.',
            'reason.min' => 'Le motif du refus doit contenir au moins 5 caractères.',
            'reason.max' => 'Le motif du refus ne peut pas dépasser 1000 caractères.',
        ]);

        DB::transaction(function () use ($request, $supplier, $validated) {
            $supplier->update([
                'validation_status' => ValidationStatus::REJECTED,
                'is_published' => false,
                'rejection_reason' => $validated['reason'],
                'validated_by' => $request->user()->id,
                'validated_at' => now(),
            ]);

            $supplier->documents()->update([
                'status' => ValidationStatus::REJECTED->value,
            ]);

            AuditLog::create([
                'admin_id' => $request->user()->id,
                'action' => 'supplier.rejected',
                'target' => "supplier_profile:{$supplier->id}",
                'reason' => $validated['reason'],
            ]);
        });

        $supplier->load(['user', 'documents', 'validator:id,name,email']);

        if ($supplier->user) {
            $supplier->user->notify(new SupplierValidationNotification(
                $supplier,
                ValidationStatus::REJECTED,
                $validated['reason']
            ));
        }

        return response()->json([
            'message' => 'Le dossier fournisseur a été refusé.',
            'supplier' => $supplier,
        ]);
    }
}
