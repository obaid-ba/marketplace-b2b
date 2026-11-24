<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Notifications\AccountStatusNotification;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Gestion des comptes utilisateurs par l'administrateur (SCRUM-71).
 *
 * Suspendre, réactiver ou supprimer un compte révoque immédiatement ses jetons
 * Sanctum : l'utilisateur est déconnecté. Chaque décision est motivée, auditée
 * et notifiée à l'intéressé.
 */
class AdminUserController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'role' => ['nullable', 'string', 'in:'.implode(',', array_column(UserRole::cases(), 'value'))],
            'status' => ['nullable', 'string', 'in:'.implode(',', UserStatus::values())],
            'include_deleted' => ['nullable', 'boolean'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = User::query()
            ->with([
                'supplierProfile:id,user_id,company_name,validation_status',
                'buyerProfile:id,user_id,organization',
            ])
            ->latest('id');

        if ($request->boolean('include_deleted')) {
            $query->withTrashed();
        }

        if (! empty($filters['q'])) {
            $term = '%'.$filters['q'].'%';
            $query->where(function ($builder) use ($term) {
                $builder->where('name', 'like', $term)
                    ->orWhere('email', 'like', $term)
                    ->orWhere('phone', 'like', $term)
                    ->orWhere('first_name', 'like', $term)
                    ->orWhere('last_name', 'like', $term);
            });
        }

        if (! empty($filters['role'])) {
            $query->where('role', $filters['role']);
        }

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        return response()->json($query->paginate((int) ($filters['per_page'] ?? 20)));
    }

    public function suspend(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:5', 'max:1000'],
        ]);

        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'Vous ne pouvez pas suspendre votre propre compte.'], 422);
        }

        if ($user->status === UserStatus::SUSPENDED) {
            return response()->json(['message' => 'Ce compte est déjà suspendu.'], 422);
        }

        DB::transaction(function () use ($request, $user, $validated) {
            $user->update(['status' => UserStatus::SUSPENDED]);
            $user->tokens()->delete();

            $this->audit->record(
                $request->user(),
                'user.suspended',
                "user:{$user->id}",
                $validated['reason'],
            );
        });

        $user->notify(new AccountStatusNotification('suspendu', $validated['reason']));

        return response()->json([
            'message' => 'Le compte a été suspendu et ses sessions ont été fermées.',
            'user' => $user->fresh(),
        ]);
    }

    public function reactivate(Request $request, User $user): JsonResponse
    {
        if ($user->trashed()) {
            return response()->json(['message' => 'Un compte supprimé ne peut pas être réactivé.'], 422);
        }

        if ($user->status === UserStatus::ACTIVE) {
            return response()->json(['message' => 'Ce compte est déjà actif.'], 422);
        }

        DB::transaction(function () use ($request, $user) {
            $user->update(['status' => UserStatus::ACTIVE]);

            $this->audit->record(
                $request->user(),
                'user.reactivated',
                "user:{$user->id}",
                null,
            );
        });

        $user->notify(new AccountStatusNotification('réactivé'));

        return response()->json([
            'message' => 'Le compte a été réactivé.',
            'user' => $user->fresh(),
        ]);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:5', 'max:1000'],
        ]);

        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'Vous ne pouvez pas supprimer votre propre compte.'], 422);
        }

        DB::transaction(function () use ($request, $user, $validated) {
            $user->tokens()->delete();

            $this->audit->record(
                $request->user(),
                'user.deleted',
                "user:{$user->id}",
                $validated['reason'],
            );

            $user->delete();
        });

        $user->notify(new AccountStatusNotification('désactivé', $validated['reason']));

        return response()->json([
            'message' => 'Le compte a été supprimé (suppression douce) et ses sessions ont été fermées.',
        ]);
    }
}
