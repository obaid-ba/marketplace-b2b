<?php

namespace App\Http\Controllers\Api\Supplier;

use App\Enums\OrderStatus;
use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Notifications\OrderStatusUpdatedNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Gestion des commandes côté fournisseur (SCRUM-58 / F16, SCRUM-55 / F18).
 */
class SupplierOrderController extends Controller
{
    /**
     * Liste paginée des commandes reçues par le fournisseur connecté.
     */
    public function index(Request $request): JsonResponse
    {
        $supplierProfile = $request->user()->supplierProfile;
        if (! $supplierProfile) {
            return response()->json(['message' => 'Profil fournisseur introuvable.'], 403);
        }

        $query = Order::query()
            ->where('supplier_id', $supplierProfile->id)
            ->with([
                'buyer.user:id,name,email,phone',
                'buyer:id,user_id,organization,sector',
                'items',
                'statusHistory',
                'documents',
                'review',
            ])
            ->orderByDesc('created_at');

        $status = $request->query('status');
        if ($status && in_array($status, OrderStatus::values(), true)) {
            $query->where('status', $status);
        }

        $perPage = max(1, min(50, (int) $request->query('per_page', 10)));
        $orders = $query->paginate($perPage);

        return response()->json($orders);
    }

    /**
     * Fait avancer le statut d'une commande selon le cycle strict : validée -> expédiée -> livrée (SCRUM-55).
     */
    public function advance(Request $request, Order $order): JsonResponse
    {
        $supplierProfile = $request->user()->supplierProfile;
        if (! $supplierProfile || $order->supplier_id !== $supplierProfile->id) {
            return response()->json(['message' => 'Accès non autorisé à cette commande.'], 403);
        }

        // Transitions autorisées uniquement dans l'ordre strict
        $nextStatus = match ($order->status) {
            OrderStatus::VALIDATED => OrderStatus::SHIPPED,
            OrderStatus::SHIPPED => OrderStatus::DELIVERED,
            default => null,
        };

        if (! $nextStatus) {
            return response()->json([
                'message' => "Transition de statut non autorisée depuis l'état actuel.",
            ], 422);
        }

        DB::transaction(function () use ($order, $nextStatus, $request) {
            $order->update(['status' => $nextStatus]);

            OrderStatusHistory::create([
                'order_id' => $order->id,
                'status' => $nextStatus,
                'changed_by' => $request->user()->id,
                'changed_at' => now(),
            ]);
        });

        // Envoi de la notification automatique à l'acheteur
        $buyerUser = $order->buyer?->user;
        if ($buyerUser) {
            $buyerUser->notify(new OrderStatusUpdatedNotification($order));
        }

        $order->load([
            'items.product',
            'statusHistory.changer:id,name',
            'documents',
            'buyer.user:id,name,email,phone',
            'supplier.user:id,name,email,phone',
            'review',
        ]);

        return response()->json([
            'message' => "Statut de la commande mis à jour vers « {$nextStatus->value} ».",
            'order' => $order,
        ]);
    }
}
