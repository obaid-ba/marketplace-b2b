<?php

namespace App\Services\Dashboard;

use App\Enums\DisputeStatus;
use App\Enums\OrderStatus;
use App\Enums\ProductStatus;
use App\Enums\UserStatus;
use App\Enums\ValidationStatus;
use App\Http\Requests\Dashboard\PeriodRangeRequest;
use App\Models\SupplierProfile;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Agrégats du tableau de bord administrateur (SCRUM-122 / F28, story SCRUM-70).
 *
 * Les indicateurs sont calculés côté serveur. Tant que les S2–S5 ne sont pas
 * fusionnés, les tables `orders`, `tenders`, `products` et `disputes` sont lues
 * via le Query Builder (lecture seule) : elles existent déjà dans les migrations.
 * Ces requêtes seront remplacées par les modèles Eloquent correspondants dès que
 * les fonctionnalités S2–S5 arriveront sur `develop`, sans changer le contrat JSON.
 *
 * Définitions provisoires (Q3 / Q5, en attente de confirmation) :
 * - revenu = somme de `orders.total` des commandes `clôturée` créées sur la période ;
 * - commandes = commandes créées sur la période ;
 * - utilisateurs actifs = comptes `actif` connectés dans les 30 jours précédant `to` ;
 * - litiges urgents = litiges `ouvert`, du plus ancien au plus récent.
 */
class AdminDashboardService
{
    /**
     * @return array<string, mixed>
     */
    public function build(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $timezone = config('app.timezone');
        $fromDb = $from->setTimezone($timezone);
        $toDb = $to->setTimezone($timezone);

        $ordersQuery = DB::table('orders')->whereBetween('created_at', [$fromDb, $toDb]);

        $revenue = (clone $ordersQuery)
            ->where('status', OrderStatus::CLOSED->value)
            ->sum('total');

        return [
            'period' => [
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
                'days' => (int) $from->diffInDays($to) + 1,
                'timezone' => PeriodRangeRequest::TIMEZONE,
            ],
            'kpis' => [
                'active_users' => $this->activeUsers($toDb),
                'validated_suppliers' => SupplierProfile::query()
                    ->where('validation_status', ValidationStatus::VALIDATED->value)
                    ->count(),
                'orders_count' => (clone $ordersQuery)->count(),
                'revenue' => number_format((float) $revenue, 2, '.', ''),
                'tenders_count' => DB::table('tenders')->whereBetween('created_at', [$fromDb, $toDb])->count(),
            ],
            'series' => $this->series($from, $to, $fromDb, $toDb),
            'validation_queue' => $this->validationQueue(),
            'urgent_disputes' => $this->urgentDisputes(),
            'top_categories' => $this->topCategories(),
            'anomaly_alerts' => [], // V2 — SCRUM-86 : emplacement réservé.
            'generated_at' => CarbonImmutable::now(PeriodRangeRequest::TIMEZONE)->toIso8601String(),
        ];
    }

    /**
     * Comptes actifs (non supprimés) connectés dans les 30 jours précédant la fin de période.
     */
    private function activeUsers(CarbonImmutable $toDb): int
    {
        return User::query()
            ->where('status', UserStatus::ACTIVE->value)
            ->whereBetween('last_login_at', [$toDb->subDays(29), $toDb])
            ->count();
    }

    /**
     * Une ligne par jour, dans le fuseau tunisien, pour les inscriptions, commandes et demandes.
     *
     * @return list<array{date: string, signups: int, orders: int, tenders: int}>
     */
    private function series(
        CarbonImmutable $from,
        CarbonImmutable $to,
        CarbonImmutable $fromDb,
        CarbonImmutable $toDb,
    ): array {
        $signups = $this->countByDay('users', $fromDb, $toDb);
        $orders = $this->countByDay('orders', $fromDb, $toDb);
        $tenders = $this->countByDay('tenders', $fromDb, $toDb);

        $series = [];
        $cursor = $from->startOfDay();

        while ($cursor->lessThanOrEqualTo($to)) {
            $date = $cursor->toDateString();
            $series[] = [
                'date' => $date,
                'signups' => $signups[$date] ?? 0,
                'orders' => $orders[$date] ?? 0,
                'tenders' => $tenders[$date] ?? 0,
            ];
            $cursor = $cursor->addDay();
        }

        return $series;
    }

    /**
     * @return array<string, int>
     */
    private function countByDay(string $table, CarbonImmutable $fromDb, CarbonImmutable $toDb): array
    {
        return DB::table($table)
            ->whereBetween('created_at', [$fromDb, $toDb])
            ->pluck('created_at')
            ->map(fn ($value) => CarbonImmutable::parse($value, config('app.timezone'))
                ->setTimezone(PeriodRangeRequest::TIMEZONE)
                ->toDateString())
            ->countBy()
            ->all();
    }

    /**
     * @return array{count: int, items: list<array<string, mixed>>}
     */
    private function validationQueue(): array
    {
        $query = SupplierProfile::query()
            ->where('validation_status', ValidationStatus::PENDING->value);

        $count = (clone $query)->count();

        $items = $query
            ->orderBy('created_at')
            ->limit(5)
            ->get(['id', 'company_name', 'created_at'])
            ->map(fn (SupplierProfile $profile) => [
                'id' => $profile->id,
                'company_name' => $profile->company_name,
                'submitted_at' => $profile->created_at?->toIso8601String(),
                'waiting_days' => $profile->created_at ? (int) $profile->created_at->diffInDays(now()) : 0,
            ])
            ->all();

        return ['count' => $count, 'items' => $items];
    }

    /**
     * @return array{count: int, items: list<array<string, mixed>>}
     */
    private function urgentDisputes(): array
    {
        $query = DB::table('disputes')->where('status', DisputeStatus::OPEN->value);

        $count = (clone $query)->count();

        $items = $query
            ->orderBy('created_at')
            ->limit(5)
            ->get(['id', 'order_id', 'reason', 'created_at'])
            ->map(function ($dispute) {
                $openedAt = CarbonImmutable::parse($dispute->created_at, config('app.timezone'));

                return [
                    'id' => $dispute->id,
                    'order_id' => $dispute->order_id,
                    'reason' => $dispute->reason,
                    'opened_at' => $openedAt->toIso8601String(),
                    'age_days' => (int) $openedAt->diffInDays(now()),
                ];
            })
            ->all();

        return ['count' => $count, 'items' => $items];
    }

    /**
     * Catégories les plus actives : nombre de produits publiés.
     *
     * @return list<array{id: int, name: string, products_count: int}>
     */
    private function topCategories(): array
    {
        return DB::table('products')
            ->join('categories', 'categories.id', '=', 'products.category_id')
            ->where('products.status', ProductStatus::PUBLISHED->value)
            ->select('categories.id', 'categories.name')
            ->selectRaw('COUNT(products.id) as products_count')
            ->groupBy('categories.id', 'categories.name')
            ->orderByRaw('COUNT(products.id) DESC')
            ->limit(5)
            ->get()
            ->map(fn ($category) => [
                'id' => $category->id,
                'name' => $category->name,
                'products_count' => (int) $category->products_count,
            ])
            ->all();
    }
}
