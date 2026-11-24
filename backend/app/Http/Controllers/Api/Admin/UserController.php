<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\OrderStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ChangeUserStatusRequest;
use App\Http\Resources\AdminUserResource;
use App\Models\Dispute;
use App\Models\Order;
use App\Models\Product;
use App\Models\Quote;
use App\Models\Tender;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\UserAdministrationService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Gestion des utilisateurs par l'administrateur (SCRUM-118 / F24).
 */
class UserController extends Controller
{
    private const DELETED = 'supprimé';

    public function __construct(
        private readonly UserAdministrationService $service,
        private readonly AuditLogger $audit,
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $role = UserRole::tryFrom($request->string('role')->toString());
        $status = $request->string('status')->toString();
        $search = trim($request->string('search')->toString());

        $users = User::query()
            ->with(['supplierProfile', 'buyerProfile'])
            ->when($role, fn (Builder $query) => $query->where('role', $role->value))
            ->when($status === self::DELETED, fn (Builder $query) => $query->onlyTrashed())
            ->when(UserStatus::tryFrom($status), fn (Builder $query) => $query->where('status', $status))
            ->when($search !== '', function (Builder $query) use ($search) {
                $term = '%'.addcslashes($search, '%_\\').'%';

                $query->where(fn (Builder $q) => $q
                    ->where('name', 'like', $term)
                    ->orWhere('email', 'like', $term)
                    ->orWhere('phone', 'like', $term)
                    ->orWhereHas('supplierProfile', fn (Builder $supplier) => $supplier->where('company_name', 'like', $term))
                    ->orWhereHas('buyerProfile', fn (Builder $buyer) => $buyer->where('organization', 'like', $term)));
            });

        match ($request->string('sort')->toString()) {
            'name' => $users->orderBy('name')->orderBy('id'),
            // Jamais connectés en dernier
            'last_login' => $users->orderByRaw('last_login_at is null')->orderByDesc('last_login_at')->orderByDesc('id'),
            default => $users->orderByDesc('created_at')->orderByDesc('id'),
        };

        return AdminUserResource::collection($users->paginate(max(1, min(50, $request->integer('per_page', 20)))))
            ->additional(['counts' => $this->counts()]);
    }

    public function show(Request $request, int $user): JsonResponse
    {
        return $this->detail($this->find($user));
    }

    public function suspend(ChangeUserStatusRequest $request, int $user): JsonResponse
    {
        return $this->detail($this->service->suspend($this->find($user), $request->user(), $request->validated('reason')));
    }

    public function reactivate(ChangeUserStatusRequest $request, int $user): JsonResponse
    {
        return $this->detail($this->service->reactivate($this->find($user), $request->user(), $request->validated('reason')));
    }

    private function find(int $id): User
    {
        return User::withTrashed()->findOrFail($id);
    }

    private function detail(User $user): JsonResponse
    {
        $user->load(['supplierProfile', 'buyerProfile']);
        $targets = ["user:{$user->id}"];

        if ($user->supplierProfile) {
            $targets[] = "supplier_profile:{$user->supplierProfile->id}"; // validation ou refus du dossier (F05)
        }

        return response()->json([
            'user' => new AdminUserResource($user),
            'activity' => $this->activity($user),
            'history' => $this->audit->historyOf($targets)->map(fn ($log) => [
                'id' => $log->id,
                'action' => $log->action,
                'reason' => $log->reason,
                'admin' => $log->admin?->name,
                'created_at' => $log->created_at?->toIso8601String(),
            ])->values(),
        ]);
    }

    /**
     * Activité du compte : aide à décider, par exemple avant de suspendre un fournisseur qui a des commandes en cours.
     *
     * @return array<string, int>
     */
    private function activity(User $user): array
    {
        [$column, $profileId] = match ($user->role) {
            UserRole::Supplier => ['supplier_id', $user->supplierProfile?->id],
            UserRole::Buyer => ['buyer_id', $user->buyerProfile?->id],
            UserRole::Admin => [null, null],
        };

        if ($profileId === null) {
            return [];
        }

        $orders = Order::query()->where($column, $profileId);

        return [
            'orders' => (clone $orders)->count(),
            'ongoing_orders' => (clone $orders)->where('status', '!=', OrderStatus::CLOSED->value)->count(),
            'open_disputes' => Dispute::query()->undecided()->whereIn('order_id', (clone $orders)->select('id'))->count(),
            ...($user->role === UserRole::Supplier
                ? [
                    'products' => Product::query()->where('supplier_id', $profileId)->count(),
                    'quotes' => Quote::query()->where('supplier_id', $profileId)->count(),
                ]
                : ['tenders' => Tender::query()->where('buyer_id', $profileId)->count()]),
        ];
    }

    /**
     * @return array<string, int>
     */
    private function counts(): array
    {
        $byStatus = User::query()->selectRaw('status, count(*) as total')->groupBy('status')->toBase()->pluck('total', 'status');

        return [
            ...collect(UserStatus::values())->mapWithKeys(fn (string $value) => [$value => (int) ($byStatus[$value] ?? 0)])->all(),
            self::DELETED => User::onlyTrashed()->count(),
        ];
    }
}
