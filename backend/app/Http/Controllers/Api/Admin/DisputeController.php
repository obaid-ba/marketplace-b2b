<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\DisputeDecision;
use App\Enums\DisputeStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Dispute\DecideDisputeRequest;
use App\Http\Resources\DisputeResource;
use App\Models\Dispute;
use App\Services\DisputeService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Gestion des litiges par l'administrateur (SCRUM-117 / F23).
 */
class DisputeController extends Controller
{
    public function __construct(private readonly DisputeService $service) {}

    /**
     * Urgence (Q5) : ouverts d'abord, puis en cours, du plus ancien au plus récent, puis par montant.
     * Les litiges décidés suivent, du plus récent au plus ancien.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $status = DisputeStatus::tryFrom($request->string('status')->toString());
        $search = trim($request->string('search')->toString());

        $disputes = Dispute::query()
            ->select('disputes.*')
            ->join('orders', 'orders.id', '=', 'disputes.order_id')
            ->with(['order.buyer.user', 'order.supplier.user', 'assignedAdmin:id,name'])
            ->when($status, fn (Builder $query) => $query->where('disputes.status', $status->value))
            ->when($request->boolean('mine'), fn (Builder $query) => $query->where('disputes.assigned_admin_id', $request->user()->id))
            ->when($search !== '', function (Builder $query) use ($search) {
                $term = '%'.addcslashes($search, '%_\\').'%';

                $query->where(fn (Builder $q) => $q
                    ->when(ctype_digit($search), fn (Builder $number) => $number->orWhere('disputes.order_id', (int) $search))
                    ->orWhereHas('order.buyer', fn (Builder $buyer) => $buyer->where('organization', 'like', $term))
                    ->orWhereHas('order.supplier', fn (Builder $supplier) => $supplier->where('company_name', 'like', $term)));
            })
            ->orderByRaw('case disputes.status when ? then 0 when ? then 1 else 2 end', [DisputeStatus::OPEN->value, DisputeStatus::IN_PROGRESS->value])
            ->orderByRaw('case when disputes.status = ? then disputes.decided_at end desc', [DisputeStatus::DECIDED->value])
            ->orderBy('disputes.created_at')
            ->orderByDesc('orders.total')
            ->paginate(max(1, min(50, $request->integer('per_page', 15))));

        $counts = Dispute::query()->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status');

        return DisputeResource::collection($disputes)->additional([
            'counts' => collect(DisputeStatus::values())->mapWithKeys(fn (string $value) => [$value => (int) ($counts[$value] ?? 0)]),
        ]);
    }

    public function show(Dispute $dispute): DisputeResource
    {
        return $this->resource($dispute);
    }

    public function take(Request $request, Dispute $dispute): DisputeResource
    {
        return $this->resource($this->service->take($dispute, $request->user()));
    }

    public function decide(DecideDisputeRequest $request, Dispute $dispute): DisputeResource
    {
        return $this->resource($this->service->decide(
            $dispute,
            $request->user(),
            DisputeDecision::from($request->validated('decision')),
            $request->validated('note'),
        ));
    }

    private function resource(Dispute $dispute): DisputeResource
    {
        return (new DisputeResource($dispute->load([
            'order.buyer.user',
            'order.supplier.user',
            'order.items',
            'order.statusHistory',
            'attachments',
            'assignedAdmin:id,name',
        ])))->additional(['decisions' => DisputeDecision::values()]);
    }
}
