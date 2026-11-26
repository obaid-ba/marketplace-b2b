<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\AnomalyStatus;
use App\Http\Controllers\Controller;
use App\Models\AnomalyAlert;
use App\Services\AnomalyDetector;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Alertes d'anomalie (SCRUM-86) : liste, analyse à la demande, « traitée » ou « ignorée ».
 */
class AnomalyAlertController extends Controller
{
    public function __construct(
        private readonly AnomalyDetector $detector,
        private readonly AuditLogger $audit,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::in(AnomalyStatus::values())],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $page = AnomalyAlert::query()
            ->where('status', $filters['status'] ?? AnomalyStatus::NEW->value)
            ->orderByDesc('score')
            ->latest('id')
            ->paginate((int) ($filters['per_page'] ?? 20));

        return response()->json([
            'data' => $this->detector->present($page->getCollection()),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total()],
            'counts' => ['new' => AnomalyAlert::query()->open()->count()],
        ]);
    }

    /** Lance la détection sans attendre la tâche planifiée (toutes les 15 minutes). */
    public function scan(): JsonResponse
    {
        $count = $this->detector->run();

        return response()->json([
            'message' => $count === 0 ? 'Aucune nouvelle anomalie détectée.' : "{$count} alerte(s) créée(s) ou mise(s) à jour.",
            'count' => $count,
        ]);
    }

    public function handle(Request $request, AnomalyAlert $alert): JsonResponse
    {
        return $this->decide($request, $alert, AnomalyStatus::HANDLED, 'anomaly.handled', 'Alerte marquée comme traitée.');
    }

    public function ignore(Request $request, AnomalyAlert $alert): JsonResponse
    {
        return $this->decide($request, $alert, AnomalyStatus::IGNORED, 'anomaly.ignored', 'Alerte ignorée.');
    }

    private function decide(Request $request, AnomalyAlert $alert, AnomalyStatus $status, string $action, string $message): JsonResponse
    {
        $validated = $request->validate(['note' => ['nullable', 'string', 'max:1000']]);

        if ($alert->status !== AnomalyStatus::NEW) {
            return response()->json(['message' => 'Cette alerte a déjà été traitée.'], 422);
        }

        $alert->update(['status' => $status]);
        $this->audit->record($request->user(), $action, "anomaly:{$alert->id}", $validated['note'] ?? null);

        return response()->json([
            'message' => $message,
            'alert' => $this->detector->present(collect([$alert]))->first(),
        ]);
    }
}
