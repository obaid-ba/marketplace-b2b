<?php

namespace App\Services\Export;

use App\Models\Export;
use App\Services\Dashboard\AdminDashboardService;
use Carbon\CarbonImmutable;

/**
 * Tableaux d'un export de statistiques (SCRUM-75), selon les indicateurs choisis.
 */
class StatisticsExport
{
    private const DAILY = ['signups', 'orders', 'revenue', 'tenders'];

    public function __construct(private readonly AdminDashboardService $dashboard) {}

    /**
     * @param  list<string>  $indicators
     * @return array<string, list<list<string|int|float>>> titre du tableau => lignes
     */
    public function tables(CarbonImmutable $from, CarbonImmutable $to, array $indicators): array
    {
        $data = $this->dashboard->build($from, $to);
        $daily = array_values(array_intersect(self::DAILY, $indicators));

        $summary = [
            ['Indicateur', 'Valeur'],
            ['Du', $data['period']['from']],
            ['Au', $data['period']['to']],
        ];

        foreach ($daily as $indicator) {
            $summary[] = [Export::INDICATORS[$indicator], round(array_sum(array_column($data['series'], $indicator)), 2)];
        }

        $tables = ['Synthèse' => $summary];

        if ($daily !== []) {
            $tables['Par jour'] = [
                ['Date', ...array_map(fn (string $indicator) => Export::INDICATORS[$indicator], $daily)],
                ...array_map(fn (array $row) => [$row['date'], ...array_map(fn (string $indicator) => $row[$indicator], $daily)], $data['series']),
            ];
        }

        if (in_array('categories', $indicators, true)) {
            $tables['Catégories'] = [
                ['Catégorie', 'Produits publiés'],
                ...array_map(fn (array $category) => [$category['name'], $category['products_count']], $this->dashboard->topCategories(null)),
            ];
        }

        return $tables;
    }
}
