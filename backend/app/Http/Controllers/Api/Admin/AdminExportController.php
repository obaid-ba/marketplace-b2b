<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\ExportRequest;
use App\Jobs\GenerateExportJob;
use App\Models\Export;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Exports des statistiques d'administration (SCRUM-75 / F28).
 *
 * CSV uniquement : XLSX reste bloqué par la validation de dépendance (Q7).
 */
class AdminExportController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $exports = Export::query()
            ->where('user_id', $request->user()->id)
            ->latest('id')
            ->paginate(max(1, min(50, (int) $request->query('per_page', 15))));

        return response()->json($exports);
    }

    public function store(ExportRequest $request): JsonResponse
    {
        $format = $request->input('format', Export::FORMAT_CSV);

        if ($format === Export::FORMAT_XLSX) {
            return response()->json([
                'message' => "Le format XLSX n'est pas encore disponible : la dépendance doit être validée (question Q7). Utilisez le format CSV.",
            ], 422);
        }

        [$from, $to] = $request->range();

        $export = Export::create([
            'user_id' => $request->user()->id,
            'format' => Export::FORMAT_CSV,
            'period_from' => $from->toDateString(),
            'period_to' => $to->toDateString(),
            'status' => Export::STATUS_QUEUED,
        ]);

        GenerateExportJob::dispatch($export);

        return response()->json([
            'message' => 'Votre export est en préparation. Vous serez notifié dès qu\'il sera prêt.',
            'export' => $export->fresh(),
        ], 202);
    }

    public function download(Request $request, Export $export): StreamedResponse|JsonResponse
    {
        if ($export->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Export introuvable.'], 404);
        }

        if ($export->status !== Export::STATUS_READY || ! $export->file_path) {
            return response()->json(['message' => 'Cet export n\'est pas encore prêt.'], 409);
        }

        /** @var FilesystemAdapter $disk */
        $disk = Storage::disk('local');

        if (! $disk->exists($export->file_path)) {
            return response()->json(['message' => 'Le fichier de l\'export est introuvable.'], 404);
        }

        return $disk->download($export->file_path, "statistiques-{$export->period_from->toDateString()}-{$export->period_to->toDateString()}.csv");
    }
}
