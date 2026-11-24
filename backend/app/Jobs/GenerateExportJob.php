<?php

namespace App\Jobs;

use App\Models\Export;
use App\Notifications\ExportReadyNotification;
use App\Services\Dashboard\AdminDashboardService;
use Carbon\CarbonImmutable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;

/**
 * Génère le fichier CSV d'un export de statistiques (SCRUM-75 / F28).
 *
 * Le job tourne en file d'attente : l'API répond immédiatement et
 * l'administrateur reçoit une notification quand le fichier est prêt.
 * Le CSV est volontairement retenu : XLSX exige une dépendance qui reste à
 * valider (question Q7).
 */
class GenerateExportJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public function __construct(public Export $export) {}

    public function handle(AdminDashboardService $dashboard): void
    {
        $export = $this->export->fresh();

        if (! $export) {
            return;
        }

        $export->update(['status' => Export::STATUS_PROCESSING]);

        try {
            $from = CarbonImmutable::parse($export->period_from)->startOfDay();
            $to = CarbonImmutable::parse($export->period_to)->endOfDay();

            $path = "exports/{$export->id}.csv";
            Storage::disk('local')->put($path, $this->toCsv($dashboard->build($from, $to)));

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

    /**
     * Sérialise les agrégats du tableau de bord en lignes `section;libellé;valeur`.
     *
     * @param  array<string, mixed>  $data
     */
    private function toCsv(array $data): string
    {
        $handle = fopen('php://temp', 'r+');
        fwrite($handle, "\xEF\xBB\xBF"); // BOM UTF-8 pour Excel.
        fputcsv($handle, ['section', 'libelle', 'valeur'], ';');

        foreach ($data['kpis'] as $key => $value) {
            fputcsv($handle, ['kpi', $key, $this->scalar($value)], ';');
        }

        foreach ($data['series'] as $row) {
            fputcsv($handle, ['serie', $row['date'], $this->scalar($row)], ';');
        }

        foreach ($data['top_categories'] as $category) {
            fputcsv($handle, ['categorie', $category['name'], $category['products_count']], ';');
        }

        fputcsv($handle, ['periode', 'du', $data['period']['from']], ';');
        fputcsv($handle, ['periode', 'au', $data['period']['to']], ';');

        rewind($handle);
        $csv = (string) stream_get_contents($handle);
        fclose($handle);

        return $csv;
    }

    private function scalar(mixed $value): string
    {
        if (is_array($value)) {
            return json_encode($value, JSON_UNESCAPED_UNICODE) ?: '';
        }

        return (string) $value;
    }
}
