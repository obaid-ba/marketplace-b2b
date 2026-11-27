<?php

namespace App\Http\Controllers\Api\Buyer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Buyer\InviteSupplierRequest;
use App\Http\Requests\Buyer\StoreTenderRequest;
use App\Http\Resources\TenderResource;
use App\Models\SupplierProfile;
use App\Models\Tender;
use App\Models\TenderAttachment;
use App\Services\TenderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Demandes du porteur de projet (SCRUM-41, SCRUM-43, SCRUM-49 / F11).
 */
class TenderController extends Controller
{
    public function __construct(private readonly TenderService $service) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $buyer = $request->user()->buyerProfile()->firstOrFail();

        $query = Tender::query()
            ->where('buyer_id', $buyer->id)
            ->with(['category:id,name', 'region:id,name'])
            ->withCount([
                'quotes',
                'recipients',
                'recipients as notified_count' => fn ($query) => $query->whereNotNull('notified_at'),
            ])
            ->latest();

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        return TenderResource::collection($query->paginate($this->perPage($request)));
    }

    public function store(StoreTenderRequest $request): JsonResponse
    {
        $tender = $this->service->publish(
            $request->user(),
            $request->safe()->except(['attachments']),
            $request->file('attachments') ?? [],
        );

        return (new TenderResource($tender))->response()->setStatusCode(201);
    }

    public function show(Request $request, Tender $tender): TenderResource
    {
        Gate::authorize('view', $tender);

        return new TenderResource(
            $tender->load([
                'category:id,name',
                'region:id,name',
                'attachments:id,tender_id,file_path,original_name',
            ])->loadCount([
                'quotes',
                'recipients',
                'recipients as notified_count' => fn ($query) => $query->whereNotNull('notified_at'),
            ])
        );
    }

    public function downloadAttachment(Tender $tender, TenderAttachment $attachment): StreamedResponse
    {
        Gate::authorize('view', $tender);

        abort_if($attachment->tender_id !== $tender->id, 404);

        abort_unless(Storage::disk('local')->exists($attachment->file_path), 404);

        return Storage::disk('local')->download(
            $attachment->file_path,
            $attachment->original_name ?? basename($attachment->file_path),
        );
    }

    public function cancel(Request $request, Tender $tender): TenderResource
    {
        Gate::authorize('cancel', $tender);

        return new TenderResource($this->service->cancel($tender, $request->user()));
    }

    public function invite(InviteSupplierRequest $request, Tender $tender): JsonResponse
    {
        Gate::authorize('invite', $tender);

        $supplier = SupplierProfile::query()->findOrFail($request->integer('supplier_id'));

        $recipient = $this->service->invite($tender, $supplier, $request->user());

        return response()->json([
            'message' => 'Fournisseur invitÃ© : il recevra une notification.',
            'recipient' => [
                'id' => $recipient->id,
                'supplier_id' => $recipient->supplier_id,
                'source' => $recipient->source,
                'score' => $recipient->score !== null ? (float) $recipient->score : null,
                'notified_at' => $recipient->notified_at?->toIso8601String(),
            ],
        ]);
    }

    private function perPage(Request $request): int
    {
        return max(1, min(50, $request->integer('per_page', 15)));
    }
}
