<?php

namespace App\Services\Dashboard;

use App\Enums\OrderStatus;
use App\Enums\QuoteStatus;
use App\Enums\TenderStatus;
use App\Http\Requests\Dashboard\PeriodRangeRequest;
use App\Models\Order;
use App\Models\ProductView;
use App\Models\Quote;
use App\Models\Review;
use App\Models\SupplierProfile;
use App\Models\TenderRecipient;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Agrégats du tableau de bord fournisseur (SCRUM-120 / F26, story SCRUM-68).
 *
 * Définitions retenues :
 * - revenu = somme des commandes `clôturée` créées sur la période ;
 * - commandes en cours = commandes non clôturées créées sur la période ;
 * - taux de devis acceptés = devis acceptés / devis envoyés sur la période ;
 * - demandes ouvertes = demandes reçues (tender_recipients) encore ouvertes,
 *   triées par score de pertinence décroissant.
 */
class SupplierDashboardService
{
    /**
     * @return array<string, mixed>
     */
    public function build(SupplierProfile $supplier, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $timezone = config('app.timezone');
        $fromDb = $from->setTimezone($timezone);
        $toDb = $to->setTimezone($timezone);

        $ordersQuery = Order::query()
            ->where('supplier_id', $supplier->id)
            ->whereBetween('created_at', [$fromDb, $toDb]);

        $revenue = (clone $ordersQuery)
            ->where('status', OrderStatus::CLOSED->value)
            ->sum('total');

        $quotesQuery = Quote::query()
            ->where('supplier_id', $supplier->id)
            ->whereBetween('created_at', [$fromDb, $toDb]);

        $quotesCount = (clone $quotesQuery)->count();
        $acceptedQuotes = (clone $quotesQuery)
            ->where('status', QuoteStatus::ACCEPTED->value)
            ->count();

        $negativeReviews = Review::query()
            ->where('supplier_id', $supplier->id)
            ->published()
            ->where('rating', '<=', 2)
            ->whereBetween('created_at', [$fromDb, $toDb])
            ->count();

        return [
            'period' => [
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
                'days' => (int) $from->diffInDays($to) + 1,
                'timezone' => PeriodRangeRequest::TIMEZONE,
            ],
            'kpis' => [
                'revenue' => number_format((float) $revenue, 2, '.', ''),
                'orders_count' => (clone $ordersQuery)->count(),
                'orders_in_progress' => (clone $ordersQuery)
                    ->where('status', '!=', OrderStatus::CLOSED->value)
                    ->count(),
                'orders_finished' => (clone $ordersQuery)
                    ->where('status', OrderStatus::CLOSED->value)
                    ->count(),
                'accepted_quote_rate' => $quotesCount > 0
                    ? round($acceptedQuotes / $quotesCount * 100, 2)
                    : 0.0,
                'quotes_count' => $quotesCount,
                'average_rating' => $supplier->rating_avg !== null ? (float) $supplier->rating_avg : null,
                'reviews_count' => (int) $supplier->reviews_count,
                'views_count' => ProductView::query()
                    ->whereIn('product_id', DB::table('products')->select('id')->where('supplier_id', $supplier->id))
                    ->whereBetween('viewed_at', [$fromDb, $toDb])
                    ->count(),
                'unread_items' => $supplier->user
                    ? $supplier->user->unreadNotifications()->count()
                    : 0,
            ],
            'negative_review_alert' => [
                'count' => $negativeReviews,
                'threshold' => 2,
                'active' => $negativeReviews > 0,
            ],
            'series' => $this->series($supplier, $from, $to, $fromDb, $toDb),
            'most_viewed_products' => $this->mostViewedProducts($supplier, $fromDb, $toDb),
            'most_sold_products' => $this->mostSoldProducts($supplier, $fromDb, $toDb),
            'open_requests' => $this->openRequests($supplier),
            'latest_reviews' => $this->latestReviews($supplier),
            'generated_at' => CarbonImmutable::now(PeriodRangeRequest::TIMEZONE)->toIso8601String(),
        ];
    }

    /**
     * @return list<array{date: string, orders: int, revenue: float}>
     */
    private function series(
        SupplierProfile $supplier,
        CarbonImmutable $from,
        CarbonImmutable $to,
        CarbonImmutable $fromDb,
        CarbonImmutable $toDb,
    ): array {
        $rows = Order::query()
            ->where('supplier_id', $supplier->id)
            ->whereBetween('created_at', [$fromDb, $toDb])
            ->get(['created_at', 'total', 'status']);

        $byDay = $rows
            ->groupBy(fn (Order $order) => CarbonImmutable::parse($order->created_at, config('app.timezone'))
                ->setTimezone(PeriodRangeRequest::TIMEZONE)
                ->toDateString())
            ->map(fn ($group) => [
                'orders' => $group->count(),
                'revenue' => round((float) $group
                    ->filter(fn (Order $order) => $order->status === OrderStatus::CLOSED)
                    ->sum(fn (Order $order) => (float) $order->total), 2),
            ]);

        $series = [];
        $cursor = $from->startOfDay();

        while ($cursor->lessThanOrEqualTo($to)) {
            $date = $cursor->toDateString();
            $day = $byDay->get($date);

            $series[] = [
                'date' => $date,
                'orders' => $day['orders'] ?? 0,
                'revenue' => $day['revenue'] ?? 0.0,
            ];

            $cursor = $cursor->addDay();
        }

        return $series;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function mostViewedProducts(SupplierProfile $supplier, CarbonImmutable $fromDb, CarbonImmutable $toDb): array
    {
        return ProductView::query()
            ->join('products', 'products.id', '=', 'product_views.product_id')
            ->where('products.supplier_id', $supplier->id)
            ->whereBetween('product_views.viewed_at', [$fromDb, $toDb])
            ->select('products.id', 'products.title')
            ->selectRaw('COUNT(product_views.id) as views_count')
            ->groupBy('products.id', 'products.title')
            ->orderByRaw('COUNT(product_views.id) DESC')
            ->limit(5)
            ->get()
            ->map(fn ($row) => [
                'id' => (int) $row->id,
                'title' => $row->title,
                'views_count' => (int) $row->views_count,
            ])
            ->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function mostSoldProducts(SupplierProfile $supplier, CarbonImmutable $fromDb, CarbonImmutable $toDb): array
    {
        return DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.supplier_id', $supplier->id)
            ->whereBetween('orders.created_at', [$fromDb, $toDb])
            ->select('order_items.product_id', 'order_items.label')
            ->selectRaw('SUM(order_items.quantity) as quantity_sold')
            ->selectRaw('SUM(order_items.quantity * order_items.unit_price) as revenue')
            ->groupBy('order_items.product_id', 'order_items.label')
            ->orderByRaw('SUM(order_items.quantity) DESC')
            ->limit(5)
            ->get()
            ->map(fn ($row) => [
                'id' => $row->product_id !== null ? (int) $row->product_id : null,
                'title' => $row->label,
                'quantity_sold' => (int) $row->quantity_sold,
                'revenue' => round((float) $row->revenue, 2),
            ])
            ->all();
    }

    /**
     * Demandes reçues encore ouvertes, de la plus pertinente à la moins pertinente.
     *
     * @return list<array<string, mixed>>
     */
    private function openRequests(SupplierProfile $supplier): array
    {
        return TenderRecipient::query()
            ->where('supplier_id', $supplier->id)
            ->whereHas('tender', fn ($query) => $query->whereIn('status', [
                TenderStatus::OPEN->value,
                TenderStatus::IN_NEGOTIATION->value,
            ]))
            ->with(['tender:id,title,budget,desired_deadline,created_at'])
            ->orderByRaw('score IS NULL')
            ->orderByDesc('score')
            ->limit(10)
            ->get()
            ->map(fn (TenderRecipient $recipient) => [
                'id' => $recipient->tender?->id,
                'title' => $recipient->tender?->title,
                'score' => $recipient->score !== null ? (float) $recipient->score : null,
                'budget' => $recipient->tender?->budget !== null ? (float) $recipient->tender->budget : null,
                'desired_deadline' => $recipient->tender?->desired_deadline?->toDateString(),
                'received_at' => $recipient->tender?->created_at?->toIso8601String(),
            ])
            ->filter(fn (array $item) => $item['id'] !== null)
            ->values()
            ->all();
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function latestReviews(SupplierProfile $supplier): array
    {
        return Review::query()
            ->where('supplier_id', $supplier->id)
            ->published()
            ->with('buyer.user:id,name,first_name,last_name')
            ->orderByDesc('created_at')
            ->limit(5)
            ->get()
            ->map(fn (Review $review) => [
                'id' => $review->id,
                'rating' => $review->rating,
                'comment' => $review->comment,
                'author' => $review->authorDisplayName(),
                'created_at' => $review->created_at?->toIso8601String(),
            ])
            ->all();
    }
}
