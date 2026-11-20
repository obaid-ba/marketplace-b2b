<?php

namespace Tests\Feature\Tender;

use App\Enums\OrderStatus;
use App\Enums\QuoteStatus;
use App\Enums\TenderStatus;
use App\Models\Category;
use App\Models\Order;
use App\Models\Quote;
use App\Models\Region;
use App\Models\SupplierProfile;
use App\Models\Tender;
use App\Models\TenderRecipient;
use App\Models\User;
use App\Notifications\OrderValidatedNotification;
use App\Notifications\QuoteAcceptedNotification;
use App\Notifications\QuoteRejectedNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Comparaison et acceptation d'un devis, création de la commande (SCRUM-47, SCRUM-48).
 */
class AcceptQuoteTest extends TestCase
{
    use RefreshDatabase;

    private Category $emballage;

    private Region $tunis;

    private User $buyerUser;

    private Tender $tender;

    private SupplierProfile $supplierA;

    private SupplierProfile $supplierB;

    private Quote $quoteA;

    private Quote $quoteB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tunis = Region::create(['name' => 'Tunis']);
        $this->emballage = Category::create(['name' => 'Emballage', 'position' => 1]);

        $this->buyerUser = User::factory()->buyer()->create();
        $this->buyerUser->buyerProfile()->create(['organization' => 'Acheteur']);

        $this->tender = Tender::create([
            'buyer_id' => $this->buyerUser->buyerProfile->id,
            'title' => 'Cartons d’emballage',
            'description' => 'Besoin de cartons solides pour expédier les commandes.',
            'category_id' => $this->emballage->id,
            'region_id' => $this->tunis->id,
            'status' => TenderStatus::OPEN,
        ]);

        $this->supplierA = $this->supplier('Fournisseur A', 4.8);
        $this->supplierB = $this->supplier('Fournisseur B', 4.1);

        $this->quoteA = Quote::create([
            'tender_id' => $this->tender->id,
            'supplier_id' => $this->supplierA->id,
            'amount' => 3200,
            'delivery_days' => 10,
            'conditions' => 'Paiement à 30 jours.',
            'status' => QuoteStatus::SENT,
        ]);

        $this->quoteB = Quote::create([
            'tender_id' => $this->tender->id,
            'supplier_id' => $this->supplierB->id,
            'amount' => 2900,
            'delivery_days' => 7,
            'status' => QuoteStatus::SENT,
        ]);

        Sanctum::actingAs($this->buyerUser);
    }

    public function test_le_porteur_compare_les_devis_avec_prix_delai_et_note(): void
    {
        $this->getJson("/api/buyer/tenders/{$this->tender->id}/quotes")
            ->assertOk()
            ->assertJsonCount(2)
            ->assertJsonPath('0.amount', 2900)
            ->assertJsonPath('0.supplier.company_name', 'Fournisseur B')
            ->assertJsonPath('0.supplier.rating_avg', 4.1);

        $this->getJson("/api/buyer/tenders/{$this->tender->id}/quotes?sort=rating&direction=desc")
            ->assertOk()
            ->assertJsonPath('0.supplier.company_name', 'Fournisseur A');
    }

    public function test_accepter_un_devis_cree_la_commande_refuse_les_autres_et_clot_la_demande(): void
    {
        Notification::fake();

        $response = $this->postJson("/api/buyer/quotes/{$this->quoteB->id}/accept")
            ->assertCreated()
            ->assertJsonPath('status', OrderStatus::VALIDATED->value)
            ->assertJsonPath('origin', 'devis')
            ->assertJsonPath('total', 2900)
            ->assertJsonPath('items.0.label', 'Cartons d’emballage')
            ->assertJsonPath('items.0.quantity', 1);

        $orderId = $response->json('id');

        $this->assertDatabaseHas('orders', [
            'id' => $orderId,
            'buyer_id' => $this->buyerUser->buyerProfile->id,
            'supplier_id' => $this->supplierB->id,
            'quote_id' => $this->quoteB->id,
            'origin' => 'devis',
            'status' => OrderStatus::VALIDATED->value,
        ]);

        $this->assertSame(QuoteStatus::ACCEPTED, $this->quoteB->refresh()->status);
        $this->assertSame(QuoteStatus::REJECTED, $this->quoteA->refresh()->status);
        $this->assertSame(TenderStatus::CLOSED, $this->tender->refresh()->status);

        Notification::assertSentTo($this->supplierB->user, QuoteAcceptedNotification::class);
        Notification::assertSentTo($this->supplierA->user, QuoteRejectedNotification::class);
        Notification::assertSentTo($this->buyerUser, OrderValidatedNotification::class);
    }

    public function test_une_double_acceptation_est_impossible(): void
    {
        $this->postJson("/api/buyer/quotes/{$this->quoteB->id}/accept")->assertCreated();

        $this->postJson("/api/buyer/quotes/{$this->quoteA->id}/accept")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['quote']);

        $this->assertSame(1, Order::query()->count());
    }

    public function test_un_autre_porteur_ne_peut_pas_accepter_le_devis(): void
    {
        $other = User::factory()->buyer()->create();
        $other->buyerProfile()->create(['organization' => 'Autre']);
        Sanctum::actingAs($other);

        $this->postJson("/api/buyer/quotes/{$this->quoteB->id}/accept")->assertForbidden();
        $this->assertSame(0, Order::query()->count());
    }

    public function test_le_porteur_suit_la_commande_creee(): void
    {
        $orderId = $this->postJson("/api/buyer/quotes/{$this->quoteB->id}/accept")
            ->assertCreated()
            ->json('id');

        $this->getJson('/api/buyer/orders')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $orderId);

        $this->getJson("/api/buyer/orders/{$orderId}")
            ->assertOk()
            ->assertJsonPath('id', $orderId)
            ->assertJsonPath('status_history.0.status', OrderStatus::VALIDATED->value)
            ->assertJsonPath('quote.tender.title', 'Cartons d’emballage');
    }

    public function test_un_fournisseur_ne_peut_pas_accepter_un_devis(): void
    {
        Sanctum::actingAs($this->supplierA->user);

        $this->postJson("/api/buyer/quotes/{$this->quoteB->id}/accept")->assertForbidden();
    }

    private function supplier(string $name, float $rating): SupplierProfile
    {
        $supplier = SupplierProfile::factory()->validated()->create([
            'company_name' => $name,
            'region_id' => $this->tunis->id,
            'rating_avg' => $rating,
        ]);
        $supplier->categories()->attach($this->emballage->id);

        TenderRecipient::create([
            'tender_id' => $this->tender->id,
            'supplier_id' => $supplier->id,
            'score' => 80,
            'source' => TenderRecipient::SOURCE_AUTOMATIC,
            'notified_at' => now(),
        ]);

        return $supplier;
    }
}
