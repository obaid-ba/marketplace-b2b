<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\ProductStatus;
use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Notifications\ProductWithdrawnNotification;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Modération du catalogue par l'administrateur (SCRUM-72 / F29).
 *
 * Le retrait est tracé dans le journal d'audit et le fournisseur est notifié
 * avec le motif. Aucun produit n'est supprimé : il passe au statut `retiré`.
 */
class AdminProductController extends Controller
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', 'string', 'in:'.implode(',', ProductStatus::values())],
            'supplier_id' => ['nullable', 'integer', 'exists:supplier_profiles,id'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = Product::query()
            ->with([
                'supplier:id,company_name,user_id',
                'category:id,name',
            ])
            // Annonces signalées par l'IA en premier (celles déjà retirées ne sont plus à traiter).
            ->orderByRaw('case when ai_flag_reason is not null and status <> ? then 0 else 1 end', [ProductStatus::WITHDRAWN->value])
            ->latest('id');

        if (! empty($filters['q'])) {
            $query->where('title', 'like', '%'.$filters['q'].'%');
        }

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['supplier_id'])) {
            $query->where('supplier_id', $filters['supplier_id']);
        }

        if (! empty($filters['category_id'])) {
            $query->where('category_id', $filters['category_id']);
        }

        return response()->json($query->paginate((int) ($filters['per_page'] ?? 20)));
    }

    public function withdraw(Request $request, Product $product): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:5', 'max:1000'],
        ]);

        if ($product->status === ProductStatus::WITHDRAWN) {
            return response()->json(['message' => 'Ce produit est déjà retiré du catalogue.'], 422);
        }

        DB::transaction(function () use ($request, $product, $validated) {
            $product->update([
                'status' => ProductStatus::WITHDRAWN,
                'withdrawal_reason' => $validated['reason'],
            ]);

            $this->audit->record(
                $request->user(),
                'product.withdrawn',
                "product:{$product->id}",
                $validated['reason'],
            );
        });

        $product->load(['supplier.user', 'category:id,name']);

        if ($product->supplier?->user) {
            $product->supplier->user->notify(new ProductWithdrawnNotification($product, $validated['reason']));
        }

        return response()->json([
            'message' => 'Le produit a été retiré du catalogue et le fournisseur a été notifié.',
            'product' => $product,
        ]);
    }
}
