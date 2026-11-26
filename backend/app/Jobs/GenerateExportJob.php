<?php

namespace App\Jobs;

use App\Http\Requests\Dashboard\PeriodRangeRequest;
use App\Models\Export;
use App\Notifications\ExportReadyNotification;
use App\Services\Export\CsvWriter;
use App\Services\Export\StatisticsExport;
use App\Services\Export\XlsxWriter;
use Carbon\CarbonImmutable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;

/**
 * Génère le fichier CSV ou XLSX d'un export de statistiques (SCRUM-75 / F28).
 *
 * Le job tourne en file d'attente : l'API répond immédiatement et
 * l'administrateur reçoit une notification quand le fichier est prêt.
 */
class GenerateExportJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public function __construct(public Export $export) {}

    public function handle(StatisticsExport $statistics, CsvWriter $csv, XlsxWriter $xlsx): void
    {
        $export = $this->export->fresh();

        if (! $export) {
            return;
        }

        $export->update(['status' => Export::STATUS_PROCESSING]);

        try {
            // Jours entiers en heure tunisienne, comme le tableau de bord.
            $from = CarbonImmutable::parse($export->period_from->toDateString(), PeriodRangeRequest::TIMEZONE)->startOfDay();
            $to = CarbonImmutable::parse($export->period_to->toDateString(), PeriodRangeRequest::TIMEZONE)->endOfDay();

            $path = "exports/{$export->id}.{$export->format}";
            $tables = $statistics->tables($from, $to, $export->selectedIndicators());
            Storage::disk('local')->put($path, $export->format === Export::FORMAT_XLSX ? $xlsx->build($tables) : $csv->build($tables));

            $export->update([
                'status' => Export::STATUS_READY,
                'file_path' => $path,
                'error' => null,
            ]);

            $export->user?->notify(new ExportReadyNotification($export));
        } catch (\Throwable $exception) {
            report($exception);

            $export->update([
                'status' => Export::STATUS_FAILED,
                'error' => 'La génération du fichier a échoué. Réessayez plus tard.',
            ]);
        }
    }
}
