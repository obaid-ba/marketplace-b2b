<?php

namespace App\Http\Controllers\Api\Buyer;

use App\Enums\OrderStatus;
use App\Enums\ProductStatus;
use App\Enums\ValidationStatus;
use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatusHistory;
use App\Models\Product;
use App\Notifications\NewOrderNotification;
use App\Notifications\OrderClosedNotification;
use App\Services\OrderDocumentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Gestion des commandes côté porteur de projet (SCRUM-51, SCRUM-58 / F16).
 */
class BuyerOrderController extends Controller
{
    /**
     * Liste paginée des commandes passées par l'acheteur connecté.
     */
    public function index(Request $request): JsonResponse
    {
        $buyerProfile = $request->user()->buyerProfile;
        if (! $buyerProfile) {
            return response()->json(['message' => 'Profil acheteur introuvable.'], 403);
        }

        $query = Order::query()
            ->where('buyer_id', $buyerProfile->id)
            ->with([
                'supplier:id,user_id,company_name,logo,region_id',
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
     * Passer une commande directe depuis la fiche produit ou le catalogue (SCRUM-51).
     * Sans panier multi-fournisseurs (tous les produits doivent appartenir au même fournisseur).
     */
    public function store(Request $request): JsonResponse
    {
        $buyerProfile = $request->user()->buyerProfile;
        if (! $buyerProfile) {
            return response()->json(['message' => 'Seul un acheteur peut passer une commande.'], 403);
        }

        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'distinct', 'exists:products,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
        ]);

        $requestedItems = collect($validated['items'])->keyBy('product_id');
        $productIds = $requestedItems->keys()->all();

        $products = Product::with('supplier.user')
            ->whereIn('id', $productIds)
            ->get()
            ->keyBy('id');

        // Vérification 1 : Tous les produits doivent appartenir au même fournisseur
        $supplierIds = $products->pluck('supplier_id')->unique();
        if ($supplierIds->count() > 1) {
            return response()->json([
                'message' => "Une commande ne peut contenir que des produits d'un seul fournisseur.",
            ], 422);
        }

        $firstProduct = $products->first();
        $supplier = $firstProduct?->supplier;

        // Vérification 2 : Le fournisseur doit être validé par l'admin
        if (! $supplier || $supplier->validation_status !== ValidationStatus::VALIDATED) {
            return response()->json([
                'message' => "Le fournisseur n'est pas autorisé à vendre (dossier non validé).",
            ], 422);
        }

        // Vérification 2 bis : compte suspendu, désactivé ou supprimé (SCRUM-118)
        if (! $supplier->canSell()) {
            return response()->json([
                'message' => "Ce fournisseur n'est plus disponible. La commande n'a pas été passée.",
            ], 422);
        }

        // Vérification 3 : Chaque produit doit être publié et en stock suffisant
        foreach ($requestedItems as $productId => $itemData) {
            $product = $products->get($productId);
            if (! $product || $product->status !== ProductStatus::PUBLISHED) {
                return response()->json([
                    'message' => "Le produit « " . ($product?->title ?? $productId) . " » n'est pas disponible à la vente.",
                ], 422);
            }

            $requestedQty = (int) $itemData['quantity'];
            if ($product->stock !== null && $requestedQty > $product->stock) {
                return response()->json([
                    'message' => "Stock insuffisant pour « {$product->title} » : {$product->stock} disponible(s), {$requestedQty} demandé(s).",
                    'product_id' => $product->id,
                    'available_stock' => $product->stock,
                    'requested_quantity' => $requestedQty,
                ], 422);
            }
        }

        // Transaction DB : décrémentation stock + création Order + OrderItems figés + OrderStatusHistory
        $order = DB::transaction(function () use ($request, $buyerProfile, $supplier, $products, $requestedItems) {
            $total = 0;
            foreach ($requestedItems as $productId => $itemData) {
                $product = $products->get($productId);
                $qty = (int) $itemData['quantity'];
                $total += $qty * (float) $product->price;
            }

            $order = Order::create([
                'buyer_id' => $buyerProfile->id,
                'supplier_id' => $supplier->id,
                'quote_id' => null,
                'origin' => 'catalogue',
                'total' => $total,
                'status' => OrderStatus::VALIDATED,
            ]);

            foreach ($requestedItems as $productId => $itemData) {
                $product = $products->get($productId);
                $qty = (int) $itemData['quantity'];

                if ($product->stock !== null) {
                    $product->decrement('stock', $qty);
                }

                // Fige la désignation et le prix unitaire
                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $product->id,
                    'label' => $product->title,
                    'quantity' => $qty,
                    'unit_price' => $product->price,
                ]);
            }

            // Statut initial
            OrderStatusHistory::create([
                'order_id' => $order->id,
                'status' => OrderStatus::VALIDATED,
                'changed_by' => $request->user()->id,
                'changed_at' => now(),
            ]);

            return $order;
        });

        // Notification fournisseur (mail + base)
        if ($supplier->user) {
            $supplier->user->notify(new NewOrderNotification($order));
        }

        $order->load([
            'items.product',
            'statusHistory.changer:id,name',
            'supplier:id,user_id,company_name,logo,region_id',
            'documents',
            'review',
        ]);

        return response()->json([
            'message' => 'Votre commande a été validée avec succès.',
            'order' => $order,
        ], 201);
    }

    /**
     * Confirmer la réception de la commande par l'acheteur et clôturer la commande (SCRUM-56).
     * Génère automatiquement la facture PDF (SCRUM-57).
     */
    public function confirmReceipt(Request $request, Order $order, OrderDocumentService $documentService): JsonResponse
    {
        $buyerProfile = $request->user()->buyerProfile;
        if (! $buyerProfile || $order->buyer_id !== $buyerProfile->id) {
            return response()->json(['message' => 'Action non autorisée sur cette commande.'], 403);
        }

        if ($order->status !== OrderStatus::DELIVERED) {
            return response()->json([
                'message' => 'La réception ne peut être confirmée que pour une commande livrée.',
            ], 422);
        }

        DB::transaction(function () use ($order, $request, $documentService) {
            // Même verrou qu'à l'ouverture d'un litige : une commande contestée ne se clôture pas (SCRUM-117).
            Order::query()->lockForUpdate()->find($order->id);
            abort_if(
                $order->disputes()->undecided()->exists(),
                422,
                "Un litige est en cours sur cette commande : elle pourra être clôturée après la décision de l'administrateur.",
            );

            $order->update([
                'status' => OrderStatus::CLOSED,
            ]);

            OrderStatusHistory::create([
                'order_id' => $order->id,
                'status' => OrderStatus::CLOSED,
                'changed_by' => $request->user()->id,
                'changed_at' => now(),
            ]);

            $documentService->generateInvoicePdf($order);
        });

        $order->load([
            'buyer.user:id,name,email,phone',
            'supplier.user:id,name,email,phone',
            'items.product',
            'statusHistory.changer:id,name',
            'documents',
            'review',
        ]);

        if ($order->supplier?->user) {
            $order->supplier->user->notify(new OrderClosedNotification($order));
        }

        return response()->json([
            'message' => 'La réception a été confirmée avec succès. La commande est désormais clôturée et la facture est disponible.',
            'order' => $order,
        ]);
    }
}
