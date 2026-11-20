<?php

namespace App\Http\Controllers\Api\Supplier;

use App\Http\Controllers\Controller;
use App\Http\Requests\Supplier\StoreQuoteRequest;
use App\Http\Resources\QuoteResource;
use App\Http\Resources\ReceivedTenderResource;
use App\Models\Quote;
use App\Models\Tender;
use App\Models\TenderAttachment;
use App\Models\TenderRecipient;
use App\Services\QuoteService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Demandes reÃ§ues et envoi de devis (SCRUM-44, SCRUM-45 / F13).
 */
class TenderController extends Controller
{
    public function __construct(private readonly QuoteService $service) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $supplier = $request->user()->supplierProfile()->firstOrFail();

        $query = TenderRecipient::query()
            ->where('supplier_id', $supplier->id)
            ->with([
                'tender.category:id,name',
                'tender.region:id,name',
                'tender.attachments:id,tender_id,file_path,original_name',
                'tender.buyer.user:id,name',
                'tender.quotes' => fn ($query) => $query->where('supplier_id', $supplier->id),
            ]);

        if ($request->filled('status')) {
            $query->whereHas('tender', fn ($tender) => $tender->where('status', $request->string('status')));
        }

        if ($request->filled('answered')) {
            $answered = $request->string('answered')->toString() === 'yes';

            $answered
                ? $query->whereHas('tender.quotes', fn ($quote) => $quote->where('supplier_id', $supplier->id))
                : $query->whereDoesntHave('tender.quotes', fn ($quote) => $quote->where('supplier_id', $supplier->id));
        }

        if ($request->filled('search')) {
            $search = '%'.$request->string('search').'%';
            $query->whereHas('tender', fn ($tender) => $tender->where('title', 'like', $search));
        }

        $sort = $request->string('sort', 'score')->toString();

        $sort === 'recent'
            ? $query->orderByDesc('notified_at')
            : $query->orderByDesc('score')->orderByDesc('notified_at');

        return ReceivedTenderResource::collection(
            $query->paginate(max(1, min(50, $request->integer('per_page', 15))))
        );
    }

    public function show(Request $request, Tender $tender): ReceivedTenderResource
    {
        $supplier = $request->user()->supplierProfile()->firstOrFail();

        $recipient = TenderRecipient::query()
            ->where('tender_id', $tender->id)
            ->where('supplier_id', $supplier->id)
            ->firstOrFail();

        if (! $recipient->seen_at) {
            $recipient->update(['seen_at' => now()]);
        }

        $recipient->load([
            'tender.category:id,name',
            'tender.region:id,name',
            'tender.attachments:id,tender_id,file_path,original_name',
            'tender.buyer.user:id,name',
            'tender.quotes' => fn ($query) => $query->where('supplier_id', $supplier->id),
        ]);

        return new ReceivedTenderResource($recipient);
    }

    public function downloadAttachment(Request $request, Tender $tender, TenderAttachment $attachment): StreamedResponse
    {
        $supplier = $request->user()->supplierProfile()->firstOrFail();

        $isRecipient = TenderRecipient::query()
            ->where('tender_id', $tender->id)
            ->where('supplier_id', $supplier->id)
            ->exists();

        abort_unless($isRecipient && $attachment->tender_id === $tender->id, 404);
        abort_unless(Storage::disk('local')->exists($attachment->file_path), 404);

        return Storage::disk('local')->download(
            $attachment->file_path,
            $attachment->original_name ?? basename($attachment->file_path),
        );
    }

    public function storeQuote(StoreQuoteRequest $request, Tender $tender): JsonResponse
    {
        $quote = $this->service->submit($request->user(), $tender, $request->validated());

        return (new QuoteResource($quote))->response()->setStatusCode(201);
    }

    public function updateQuote(StoreQuoteRequest $request, Tender $tender): QuoteResource
    {
        $quote = $this->service->submit($request->user(), $tender, $request->validated());

        return new QuoteResource($quote);
    }

    public function myQuotes(Request $request): AnonymousResourceCollection
    {
        $supplier = $request->user()->supplierProfile()->firstOrFail();

        $query = Quote::query()
            ->where('supplier_id', $supplier->id)
            ->with([
                'tender:id,title,description,status,desired_deadline,category_id,region_id',
                'tender.category:id,name',
                'tender.region:id,name',
            ])
            ->latest();

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        return QuoteResource::collection(
            $query->paginate(max(1, min(50, $request->integer('per_page', 15))))
        );
    }
}
