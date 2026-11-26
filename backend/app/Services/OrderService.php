<?php

namespace App\Services;

use App\Models\BuyerProfile;
use App\Models\Order;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/**
 * Consultation des commandes du porteur (créées par acceptation d'un devis en S3).
 */
class OrderService
{
    public function forBuyer(User $user, int $perPage = 15): LengthAwarePaginator
    {
        $buyer = $this->buyerProfile($user);

        return Order::query()
            ->where('buyer_id', $buyer->id)
            ->with(['supplier:id,user_id,company_name,rating_avg,reviews_count', 'quote.tender:id,title'])
            ->withCount('items')
            ->latest()
            ->paginate($perPage);
    }

    public function show(User $user, Order $order): Order
    {
        $buyer = $this->buyerProfile($user);

        abort_if($order->buyer_id !== $buyer->id, 403, 'Cette commande ne vous appartient pas.');

        return $order->load([
            'items',
            'statusHistory.changedBy:id,name',
            'quote:id,tender_id,supplier_id,amount,delivery_days,conditions,comment,status',
            'quote.tender:id,title,description,category_id,region_id,status',
            'quote.tender.category:id,name',
            'quote.tender.region:id,name',
            'supplier:id,user_id,company_name,rating_avg,reviews_count,professional_email,professional_phone',
        ]);
    }

    private function buyerProfile(User $user): BuyerProfile
    {
        $buyer = $user->buyerProfile()->first();

        if (! $buyer) {
            abort(404, 'Profil porteur de projet introuvable.');
        }

        return $buyer;
    }
}
