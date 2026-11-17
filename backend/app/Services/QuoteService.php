<?php

namespace App\Services;

use App\Enums\OrderStatus;
use App\Enums\QuoteStatus;
use App\Models\BuyerProfile;
use App\Models\Order;
use App\Models\Quote;
use App\Models\SupplierProfile;
use App\Models\Tender;
use App\Models\User;
use App\Notifications\NewQuoteNotification;
use App\Notifications\OrderValidatedNotification;
use App\Notifications\QuoteAcceptedNotification;
use App\Notifications\QuoteRejectedNotification;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Règles métier des devis (SCRUM-44 à SCRUM-48).
 */
class QuoteService
{
    /**
     * Enregistre ou met à jour le devis d'un fournisseur pour une demande.
     * Un seul devis par demande, modifiable tant qu'il n'est pas accepté.
     *
     * @param  array<string, mixed>  $data
     */
    public function submit(User $user, Tender $tender, array $data): Quote
    {
        $supplier = $this->supplierProfile($user);

        $quote = DB::transaction(function () use ($supplier, $tender, $data) {
            /** @var Tender $lockedTender */
            $lockedTender = Tender::query()->whereKey($tender->getKey())->lockForUpdate()->firstOrFail();

            $recipient = $lockedTender->recipients()
                ->where('supplier_id', $supplier->id)
                ->lockForUpdate()
                ->first();

            abort_if(! $recipient, 403, 'Cette demande ne vous a pas été adressée.');

            if (! $lockedTender->isOpen()) {
                throw ValidationException::withMessages([
                    'tender' => 'Cette demande est clôturée ou annulée : aucun devis ne peut être envoyé.',
                ]);
            }

            /** @var Quote $quote */
            $quote = Quote::query()->firstOrNew([
                'tender_id' => $lockedTender->id,
                'supplier_id' => $supplier->id,
            ]);

            if ($quote->exists && $quote->status === QuoteStatus::ACCEPTED) {
                throw ValidationException::withMessages([
                    'tender' => 'Ce devis a déjà été accepté et ne peut plus être modifié.',
                ]);
            }

            $quote->fill([
                'amount' => $data['amount'],
                'delivery_days' => $data['delivery_days'],
                'conditions' => $data['conditions'] ?? null,
                'comment' => $data['comment'] ?? null,
                'status' => QuoteStatus::SENT,
            ])->save();

            $recipient->forceFill([
                'seen_at' => $recipient->seen_at ?? now(),
                'notified_at' => $recipient->notified_at ?? now(),
            ])->save();

            return $quote;
        });

        $this->notifyBuyer($quote);

        return $this->loadForSupplier($quote->refresh());
    }

    /**
     * Marque une demande comme consultée par le fournisseur.
     */
    public function markSeen(User $user, Tender $tender): void
    {
        $supplier = $this->supplierProfile($user);

        $tender->recipients()
            ->where('supplier_id', $supplier->id)
            ->whereNull('seen_at')
            ->update(['seen_at' => now()]);
    }

    /**
     * Accepte un devis : crée la commande, refuse les autres devis et clôt la demande
     * dans une seule transaction (Décision 1, SCRUM-48).
     */
    public function accept(User $user, Quote $quote): Order
    {
        [$order, $accepted, $rejected] = DB::transaction(function () use ($user, $quote) {
            /** @var Quote $accepted */
            $accepted = Quote::query()->whereKey($quote->getKey())->lockForUpdate()->firstOrFail();

            /** @var Tender $tender */
            $tender = Tender::query()->whereKey($accepted->tender_id)->lockForUpdate()->firstOrFail();

            $buyer = $this->buyerProfile($user);

            abort_if($tender->buyer_id !== $buyer->id, 403, 'Cette demande ne vous appartient pas.');

            if (! $tender->isOpen()) {
                throw ValidationException::withMessages([
                    'quote' => 'Cette demande est déjà clôturée ou annulée.',
                ]);
            }

            if ($accepted->status === QuoteStatus::ACCEPTED) {
                throw ValidationException::withMessages([
                    'quote' => 'Ce devis a déjà été accepté.',
                ]);
            }

            if (! in_array($accepted->status, [QuoteStatus::SENT, QuoteStatus::IN_NEGOTIATION], true)) {
                throw ValidationException::withMessages([
                    'quote' => 'Ce devis ne peut plus être accepté.',
                ]);
            }

            if (Order::query()->where('quote_id', $accepted->id)->exists()) {
                throw ValidationException::withMessages([
                    'quote' => 'Une commande existe déjà pour ce devis.',
                ]);
            }

            /** @var Order $order */
            $order = Order::query()->create([
                'buyer_id' => $buyer->id,
                'supplier_id' => $accepted->supplier_id,
                'quote_id' => $accepted->id,
                'origin' => 'devis',
                'total' => $accepted->amount,
                'status' => OrderStatus::VALIDATED,
            ]);

            $order->items()->create([
                'label' => $tender->title,
                'quantity' => 1,
                'unit_price' => $accepted->amount,
            ]);

            $order->statusHistory()->create([
                'status' => OrderStatus::VALIDATED,
                'changed_by' => $user->id,
                'changed_at' => now(),
            ]);

            $accepted->update(['status' => QuoteStatus::ACCEPTED]);

            $rejected = $tender->quotes()
                ->whereKeyNot($accepted->id)
                ->get();

            $tender->quotes()
                ->whereKeyNot($accepted->id)
                ->update(['status' => QuoteStatus::REJECTED]);

            $tender->update(['status' => \App\Enums\TenderStatus::CLOSED]);

            return [$order, $accepted->refresh(), $rejected];
        });

        $this->notifyDecision($user, $order, $accepted, $rejected);

        return $this->loadOrder($order->refresh());
    }

    public function loadForSupplier(Quote $quote): Quote
    {
        return $quote->load([
            'tender:id,title,status,desired_deadline,budget,category_id,region_id',
            'tender.category:id,name',
            'tender.region:id,name',
        ]);
    }

    public function loadOrder(Order $order): Order
    {
        return $order->load([
            'items',
            'statusHistory',
            'quote:id,tender_id,supplier_id,amount,delivery_days,conditions,status',
            'quote.tender:id,title,description,category_id,region_id',
            'quote.tender.category:id,name',
            'quote.tender.region:id,name',
            'supplier:id,user_id,company_name,rating_avg,reviews_count,professional_email,professional_phone',
        ]);
    }

    private function supplierProfile(User $user): SupplierProfile
    {
        $supplier = $user->supplierProfile()->first();

        if (! $supplier) {
            abort(404, 'Profil fournisseur introuvable.');
        }

        return $supplier;
    }

    private function buyerProfile(User $user): BuyerProfile
    {
        $buyer = $user->buyerProfile()->first();

        if (! $buyer) {
            abort(404, 'Profil porteur de projet introuvable.');
        }

        return $buyer;
    }

    private function notifyBuyer(Quote $quote): void
    {
        $quote->loadMissing('tender.buyer.user');

        $buyerUser = $quote->tender->buyer?->user;

        $buyerUser?->notify(new NewQuoteNotification($quote));
    }

    /**
     * @param  Collection<int, Quote>  $rejected
     */
    private function notifyDecision(User $buyerUser, Order $order, Quote $accepted, Collection $rejected): void
    {
        $accepted->loadMissing('supplier.user');

        $accepted->supplier?->user?->notify(new QuoteAcceptedNotification($accepted, $order));
        $buyerUser->notify(new OrderValidatedNotification($order));

        foreach ($rejected as $quote) {
            $quote->loadMissing('supplier.user');
            $quote->supplier?->user?->notify(new QuoteRejectedNotification($quote));
        }
    }
}
