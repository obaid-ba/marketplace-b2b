<?php

namespace App\Http\Controllers\Api;

use App\Enums\DisputeReason;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dispute\OpenDisputeRequest;
use App\Http\Resources\DisputeResource;
use App\Models\Dispute;
use App\Models\Order;
use App\Services\DisputeService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Litiges côté acheteur et fournisseur (SCRUM-117 / F23). Un tiers reçoit 404.
 */
class DisputeController extends Controller
{
    public function __construct(private readonly DisputeService $service) {}

    /**
     * « Mes litiges » (SCRUM-67) : ceux des commandes de l'acheteur ou du fournisseur connecté.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $user = $request->user();
        [$column, $profileId] = $user->hasRole(UserRole::Buyer)
            ? ['buyer_id', $user->buyerProfile?->id]
            : ['supplier_id', $user->supplierProfile?->id];

        abort_if($profileId === null, 403, 'Profil introuvable.');

        return DisputeResource::collection(
            Dispute::query()
                ->whereHas('order', fn (Builder $order) => $order->where($column, $profileId))
                ->with(['order.buyer.user', 'order.supplier.user', 'attachments'])
                ->latest('id')
                ->paginate(max(1, min(50, $request->integer('per_page', 15))))
        );
    }

    /**
     * Dernier litige d'une commande et possibilité d'en ouvrir un (bloc « Litige » de la page de suivi).
     */
    public function forOrder(Request $request, int $order): JsonResponse
    {
        $model = $this->findOrder($request, $order);
        $dispute = $model->disputes()->latest('id')->first();
        $refusal = $this->service->refusalFor($request->user(), $model);

        return response()->json([
            'dispute' => $dispute?->only(['id', 'status', 'reason', 'decision']),
            'can_open' => $refusal === null,
            'reasons' => $refusal === null ? DisputeReason::values() : [],
        ]);
    }

    public function store(OpenDisputeRequest $request, int $order): JsonResponse
    {
        $dispute = $this->service->open(
            $request->user(),
            $this->findOrder($request, $order),
            $request->safe()->only(['reason', 'description']),
            array_values($request->file('attachments', [])),
        );

        return $this->resource($dispute)->response()->setStatusCode(201);
    }

    public function show(Request $request, int $dispute): DisputeResource
    {
        return $this->resource($this->find($request, $dispute));
    }

    public function attachment(Request $request, int $dispute, int $attachment): StreamedResponse
    {
        $model = $this->find($request, $dispute)->attachments()->findOrFail($attachment);
        $disk = Storage::disk(DisputeService::ATTACHMENT_DISK);

        abort_unless($disk->exists($model->file_path), 404, "Ce fichier n'est plus disponible.");

        return $disk->download($model->file_path, $model->original_name, ['X-Content-Type-Options' => 'nosniff']);
    }

    private function find(Request $request, int $id): Dispute
    {
        $dispute = Dispute::query()->with(['order.buyer', 'order.supplier'])->findOrFail($id);
        abort_unless($this->service->canView($request->user(), $dispute), 404, 'Litige introuvable.');

        return $dispute;
    }

    private function findOrder(Request $request, int $id): Order
    {
        $order = Order::query()->with(['buyer', 'supplier'])->findOrFail($id);
        abort_unless(
            in_array($request->user()->id, [$order->buyer?->user_id, $order->supplier?->user_id], true),
            404,
            'Commande introuvable.',
        );

        return $order;
    }

    private function resource(Dispute $dispute): DisputeResource
    {
        return new DisputeResource($dispute->load(['order.buyer.user', 'order.supplier.user', 'attachments']));
    }
}
