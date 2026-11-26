<?php

namespace App\Http\Controllers\Api\Buyer;

use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Http\Resources\QuoteResource;
use App\Models\Quote;
use App\Models\Tender;
use App\Services\QuoteService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;

/**
 * Comparaison et acceptation des devis reçus (SCRUM-47, SCRUM-48 / F14).
 */
class QuoteController extends Controller
{
    public function __construct(private readonly QuoteService $service) {}

    public function index(Request $request, Tender $tender): AnonymousResourceCollection
    {
        Gate::authorize('view', $tender);

        $quotes = $tender->quotes()
            ->with([
                'supplier:id,user_id,company_name,rating_avg,reviews_count,delivery_days,payment_terms,professional_email,professional_phone,region_id',
                'supplier.region:id,name',
                'tender:id,title,description,status,desired_deadline,category_id,region_id',
                'tender.category:id,name',
                'tender.region:id,name',
            ])
            ->get();

        $sort = match ($request->string('sort', 'amount')->toString()) {
            'delivery' => 'delivery_days',
            'rating' => 'rating',
            default => 'amount',
        };

        $direction = $request->string('direction', 'asc')->toString() === 'desc' ? 'desc' : 'asc';

        $quotes = match ($sort) {
            'delivery' => $quotes->sortBy(fn (Quote $quote) => $quote->delivery_days, SORT_REGULAR, $direction === 'desc'),
            'rating' => $quotes->sortBy(fn (Quote $quote) => (float) ($quote->supplier?->rating_avg ?? 0), SORT_REGULAR, $direction === 'desc'),
            default => $quotes->sortBy(fn (Quote $quote) => (float) $quote->amount, SORT_REGULAR, $direction === 'desc'),
        };

        return QuoteResource::collection($quotes->values());
    }

    public function accept(Request $request, Quote $quote): JsonResponse
    {
        Gate::authorize('accept', $quote);

        $order = $this->service->accept($request->user(), $quote);

        return (new OrderResource($order))->response()->setStatusCode(201);
    }
}
