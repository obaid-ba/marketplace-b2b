<?php

namespace App\Services\Dashboard;

use App\Enums\OrderStatus;
use App\Enums\QuoteStatus;
use App\Enums\TenderStatus;
use App\Http\Requests\Dashboard\PeriodRangeRequest;
use App\Models\BuyerProfile;
use App\Models\Favorite;
use App\Models\Order;
use App\Models\Quote;
use App\Models\Tender;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

/**
 * Agrégats du tableau de bord porteur de projet (SCRUM-121 / F27, story SCRUM-69).
 *
 * Toutes les valeurs sont calculées côté serveur pour la période demandée.
 * Définitions retenues :
 * - dépenses = somme des commandes passées sur la période (tous statuts) ;
 * - demandes publiées = demandes encore ouvertes ou en négociation ;
 * - devis en attente = devis `envoyé` ou `en négociation` sur les demandes du porteur.
 */
class BuyerDashboardService
{
    /**
     * @return array<string, mixed>
     */
    public function build(BuyerProfile $buyer, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $timezone = config('app.timezone');
        $fromDb = $from->setTimezone($timezone);
        $toDb = $to->setTimezone($timezone);

        $ordersQuery = Order::query()
            ->where('buyer_id', $buyer->id)
            ->whereBetween('created_at', [$fromDb, $toDb]);

        $ordersCount = (clone $ordersQuery)->count();
        $spending = (clone $ordersQuery)->sum('total');

        $closedQuery = (clone $ordersQuery)->where('status', OrderStatus::CLOSED->value);

        return [
            'period' => [
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
                'days' => (int) $from->diffInDays($to) + 1,
                'timezone' => PeriodRangeRequest::TIMEZONE,
            ],
            'kpis' => [
                'spending' => number_format((float) $spending, 2, '.', ''),
                'orders_count' => $ordersCount,
                'orders_in_progress' => (clone $ordersQuery)
                    ->where('status', '!=', OrderStatus::CLOSED->value)
                    ->count(),
                'orders_closed' => (clone $closedQuery)->count(),
                'published_requests' => Tender::query()
                    ->where('buyer_id', $buyer->id)
                    ->whereIn('status', [TenderStatus::OPEN->value, TenderStatus::IN_NEGOTIATION->value])
                    ->count(),
                'pending_quotes' => $this->pendingQuotesQuery($buyer)->count(),
                'favorite_suppliers' => Favorite::query()->where('buyer_id', $buyer->id)->count(),
            ],
            'series' => $this->series($buyer, $from, $to, $fromDb, $toDb),
            'published_requests' => $this->publishedRequests($buyer),
            'pending_quotes' => $this->pendingQuotes($buyer),
            'favorite_suppliers' => $this->favoriteSuppliers($buyer),
            'latest_orders' => $this->latestOrders($buyer),
            'generated_at' => CarbonImmutable::now(PeriodRangeRequest::TIMEZONE)->toIso8601String(),
        ];
    }

    /**
     * @return Builder<Quote>
     */
    private function pendingQuotesQuery(BuyerProfile $buyer)
    {
        return Quote::query()
            ->whereHas('tender', fn ($query) => $query->where('buyer_id', $buyer->id))
            ->whereIn('status', [QuoteStatus::SENT->value, QuoteStatus::IN_NEGOTIATION->value]);
    }

    /**
     * Une ligne par jour : commandes passées et montant engagé.
     *
     * @return list<array{date: string, orders: int, spending: float}>
     */
    private function series(
        BuyerProfile $buyer,
        CarbonImmutable $from,
        CarbonImmutable $to,
        CarbonImmutable $fromDb,
        CarbonImmutable $toDb,
    ): array {
        $rows = Order::query()
            ->where('buyer_id', $buyer->id)
            ->whereBetween('created_at', [$fromDb, $toDb])
            ->get(['created_at', 'total']);

        $byDay = $rows
            ->groupBy(fn (Order $order) => CarbonImmutable::parse($order->created_at, config('app.timezone'))
                ->setTimezone(PeriodRangeRequest::TIMEZONE)
                ->toDateString())
            ->map(fn ($group) => [
                'orders' => $group->count(),
                'spending' => round((float) $group->sum(fn (Order $order) => (float) $order->total), 2),
            ]);

        $series = [];
        $cursor = $from->startOfDay();

        while ($cursor->lessThanOrEqualTo($to)) {
            $date = $cursor->toDateString();
            $day = $byDay->get($date);

            $series[] = [
                'date' => $date,
                'orders' => $day['orders'] ?? 0,
                'spending' => $day['spending'] ?? 0.0,
            ];

            $cursor = $cursor->addDay();
        }

        return $series;
    }

    /**
     * Demandes du porteur encore ouvertes, avec le nombre de devis reçus.
     *
     * @return list<array<string, mixed>>
     */
    private function publishedRequests(BuyerProfile $buyer): array
    {
        return Tender::query()
            ->where('buyer_id', $buyer->id)
            ->whereIn('status', [TenderStatus::OPEN->value, TenderStatus::IN_NEGOTIATION->value])
            ->withCount('quotes')
            ->orderByDesc('created_at')
            ->limit(10)
            ->get()
            ->map(fn (Tender $tender) => [
                'id' => $tender->id,
                'title' => $tender->title,
                'status' => $tender->status?->value,
                'status_label' => $tender->statusLabel(),
                'quotes_received' => $tender->quotes_count,
                'desired_deadline' => $tender->desired_deadline?->toDateString(),
                'budget' => $tender->budget !== null ? (float) $tender->budget : null,
                'created_at' => $tender->created_at?->toIso8601String(),
            ])
            ->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function pendingQuotes(BuyerProfile $buyer): array
    {
        return $this->pendingQuotesQuery($buyer)
            ->with([
                'tender:id,title',
                'supplier:id,company_name,rating_avg',
            ])
            ->orderByDesc('created_at')
            ->limit(10)
            ->get()
            ->map(fn (Quote $quote) => [
                'id' => $quote->id,
                'tender_id' => $quote->tender_id,
                'tender' => $quote->tender?->title,
                'supplier' => $quote->supplier?->company_name,
                'supplier_rating' => $quote->supplier?->rating_avg !== null
                    ? (float) $quote->supplier->rating_avg
                    : null,
                'amount' => (float) $quote->amount,
                'delivery_days' => $quote->delivery_days,
                'status' => $quote->status?->value,
                'received_at' => $quote->created_at?->toIso8601String(),
            ])
            ->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function favoriteSuppliers(BuyerProfile $buyer): array
    {
        return Favorite::query()
            ->where('buyer_id', $buyer->id)
            ->with('supplier:id,company_name,rating_avg,region_id')
            ->latest('id')
            ->limit(10)
            ->get()
            ->map(fn (Favorite $favorite) => [
                'id' => $favorite->supplier?->id,
                'company_name' => $favorite->supplier?->company_name,
                'rating_avg' => $favorite->supplier?->rating_avg !== null
                    ? (float) $favorite->supplier->rating_avg
                    : null,
            ])
            ->filter(fn (array $item) => $item['id'] !== null)
            ->values()
            ->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function latestOrders(BuyerProfile $buyer): array
    {
        return Order::query()
            ->where('buyer_id', $buyer->id)
            ->with('supplier:id,company_name')
            // Commandes en cours d'abord, avec leur étape (SCRUM-69).
            ->orderByRaw('case when status = ? then 1 else 0 end', [OrderStatus::CLOSED->value])
            ->orderByDesc('created_at')
            ->limit(5)
            ->get()
            ->map(fn (Order $order) => [
                'id' => $order->id,
                'total' => (float) $order->total,
                'status' => $order->status?->value,
                'supplier' => $order->supplier?->company_name,
                'created_at' => $order->created_at?->toIso8601String(),
            ])
            ->all();
    }
}
