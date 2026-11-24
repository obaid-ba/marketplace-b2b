<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\DisputeStatus;
use App\Http\Controllers\Controller;
use App\Models\Dispute;
use App\Models\DisputeAttachment;
use App\Notifications\DisputeUpdatedNotification;
use App\Services\AuditLogger;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Traitement des litiges par l'administration (SCRUM-73 / F21).
 *
 * La file est triée par urgence : litiges ouverts du plus ancien au plus récent,
 * puis litiges en cours, puis litiges décidés. L'administrateur peut prendre en
 * charge un litige (`en cours`) puis rendre une décision motivée (`décidé`).
 */
class AdminDisputeController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['nullable', 'string', 'in:'.implode(',', DisputeStatus::values())],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = Dispute::query()
            ->with([
                'order:id,buyer_id,supplier_id,total,status,created_at',
                'order.buyer.user:id,name,email',
                'order.supplier:id,company_name,user_id',
                'opener:id,name,email',
                'assignedAdmin:id,name',
                'attachments',
            ]);

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        $query
            ->orderByRaw(
                'CASE WHEN status = ? THEN 0 WHEN status = ? THEN 1 ELSE 2 END',
                [DisputeStatus::OPEN->value, DisputeStatus::IN_PROGRESS->value],
            )
            ->orderBy('created_at');

        return response()->json($query->paginate((int) ($filters['per_page'] ?? 20)));
    }

    public function show(Dispute $dispute): JsonResponse
    {
        $dispute->load([
            'order.buyer.user:id,name,email',
            'order.supplier:id,company_name,user_id',
            'opener:id,name,email',
            'assignedAdmin:id,name',
            'attachments',
        ]);

        return response()->json(['dispute' => $dispute]);
    }

    public function assign(Request $request, Dispute $dispute): JsonResponse
    {
        if ($dispute->isDecided()) {
            return response()->json(['message' => 'Ce litige est déjà décidé.'], 422);
        }

        DB::transaction(function () use ($request, $dispute) {
            $dispute->update([
                'status' => DisputeStatus::IN_PROGRESS,
                'assigned_admin_id' => $request->user()->id,
            ]);

            $this->audit->record(
                $request->user(),
                'dispute.assigned',
                "dispute:{$dispute->id}",
                null,
            );
        });

        $dispute->load(['order.buyer.user', 'order.supplier.user']);
        $this->notifyParties($dispute, 'assigned');

        return response()->json([
            'message' => 'Le litige est désormais en cours et vous a été assigné.',
            'dispute' => $dispute->fresh(['assignedAdmin:id,name', 'attachments']),
        ]);
    }

    public function decide(Request $request, Dispute $dispute): JsonResponse
    {
        $validated = $request->validate([
            'decision' => ['required', 'string', 'min:3', 'max:255'],
            'note' => ['required', 'string', 'min:5', 'max:5000'],
        ]);

        if ($dispute->isDecided()) {
            return response()->json(['message' => 'Ce litige est déjà décidé.'], 422);
        }

        DB::transaction(function () use ($request, $dispute, $validated) {
            $dispute->update([
                'status' => DisputeStatus::DECIDED,
                'assigned_admin_id' => $dispute->assigned_admin_id ?? $request->user()->id,
                'decision' => $validated['decision'],
                'decision_note' => $validated['note'],
            ]);

            $this->audit->record(
                $request->user(),
                'dispute.decided',
                "dispute:{$dispute->id}",
                $validated['note'],
            );
        });

        $dispute->load(['order.buyer.user', 'order.supplier.user']);
        $this->notifyParties($dispute, 'decided');

        return response()->json([
            'message' => 'La décision a été enregistrée et les deux parties ont été notifiées.',
            'dispute' => $dispute->fresh(['assignedAdmin:id,name', 'attachments']),
        ]);
    }

    public function downloadAttachment(Dispute $dispute, DisputeAttachment $attachment): StreamedResponse|JsonResponse
    {
        if ($attachment->dispute_id !== $dispute->id) {
            return response()->json(['message' => 'Pièce jointe introuvable.'], 404);
        }

        /** @var FilesystemAdapter $disk */
        $disk = Storage::disk('local');

        if (! $disk->exists($attachment->file_path)) {
            return response()->json(['message' => 'Le fichier demandé est introuvable.'], 404);
        }

        return $disk->download($attachment->file_path, basename($attachment->file_path));
    }

    private function notifyParties(Dispute $dispute, string $event): void
    {
        $notification = new DisputeUpdatedNotification($dispute, $event);

        $dispute->opener?->notify($notification);

        $supplierUser = $dispute->order?->supplier?->user;
        if ($supplierUser && $supplierUser->id !== $dispute->opener?->id) {
            $supplierUser->notify($notification);
        }
    }
}
