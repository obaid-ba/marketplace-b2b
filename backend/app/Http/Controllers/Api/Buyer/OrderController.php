<?php

namespace App\Http\Controllers\Api\Buyer;

use App\Http\Controllers\Controller;
use App\Http\Resources\OrderResource;
use App\Models\Order;
use App\Services\OrderService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;

/**
 * Suivi des commandes du porteur, sans paiement en ligne (SCRUM-48 / F14).
 */
class OrderController extends Controller
{
    public function __construct(private readonly OrderService $service) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        return OrderResource::collection($this->service->forBuyer($request->user()));
    }

    public function show(Request $request, Order $order): OrderResource
    {
        $buyer = $request->user()->buyerProfile;

        abort_if(! $buyer || $order->buyer_id !== $buyer->id, 403, 'Cette commande ne vous appartient pas.');

        return new OrderResource($this->service->show($request->user(), $order));
    }
}
