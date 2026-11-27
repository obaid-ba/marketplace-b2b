<?php

namespace Tests\Feature\Journey;

use App\Enums\OrderStatus;
use App\Enums\QuoteStatus;
use App\Enums\TenderStatus;
use App\Models\Category;
use App\Models\Order;
use App\Models\Quote;
use App\Models\Region;
use App\Models\SupplierProfile;
use App\Models\Tender;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Parcours clé de bout en bout (SCRUM-89 / F34), uniquement par l'API :
 * demande → diffusion → devis → comparaison → acceptation → commande → suivi → clôture → avis,
 * avec les règles métier (un devis par demande, R1, transitions de statut, un avis par commande).
 *
 * Le paiement en ligne n'existe pas dans l'API (pas de Stripe, voir SCRUM-93) : la commande avance
 * directement de « validée » à « expédiée ».
 */
class TenderToReviewJourneyTest extends TestCase
{
    use RefreshDatabase;

    public function test_parcours_complet_demande_devis_commande_avis(): void
    {
        Notification::fake();
        Storage::fake('local');

        $category = Category::create(['name' => 'Emballage', 'position' => 1]);
        $sfax = Region::create(['name' => 'Sfax']);

        $atlas = SupplierProfile::factory()->visible()->create(['company_name' => 'Atlas', 'region_id' => $sfax->id]);
        $djerba = SupplierProfile::factory()->visible()->create(['company_name' => 'Djerba Pack', 'region_id' => $sfax->id]);
        $atlas->categories()->attach($category->id);
        $djerba->categories()->attach($category->id);

        $buyer = User::factory()->buyer()->create();
        $buyer->buyerProfile()->create(['organization' => 'Huilerie du Sahel']);

        // 1. Le porteur publie sa demande ; elle est diffusée aux deux fournisseurs de la catégorie et de la région.
        $tenderId = $this->actingAs($buyer, 'sanctum')->postJson('/api/buyer/tenders', [
            'title' => 'Cartons ondulés pour huile',
            'description' => 'Nous cherchons 5000 cartons ondulés double cannelure pour expédier nos bouteilles.',
            'category_id' => $category->id,
            'region_id' => $sfax->id,
            'budget' => 4000,
        ])->assertCreated()->json('id');

        $this->actingAs($atlas->user, 'sanctum')->getJson('/api/supplier/tenders')
            ->assertOk()
            ->assertJsonPath('data.0.tender.id', $tenderId);

        // 2. Chaque fournisseur envoie un devis ; renvoyer un devis met à jour le même (un seul devis par demande).
        $this->actingAs($atlas->user, 'sanctum')->postJson("/api/supplier/tenders/{$tenderId}/quote", [
            'amount' => 3800, 'delivery_days' => 10, 'conditions' => 'Paiement à 30 jours',
        ])->assertCreated();
        $this->postJson("/api/supplier/tenders/{$tenderId}/quote", ['amount' => 3500, 'delivery_days' => 10])
            ->assertSuccessful();
        $this->assertSame(1, Quote::query()->where('supplier_id', $atlas->id)->count());
        $this->assertEquals(3500, Quote::query()->where('supplier_id', $atlas->id)->value('amount'));
        $this->actingAs($djerba->user, 'sanctum')->postJson("/api/supplier/tenders/{$tenderId}/quote", [
            'amount' => 3200, 'delivery_days' => 15,
        ])->assertCreated();

        // 3. Le porteur compare et accepte le devis d'Atlas.
        $quotes = $this->actingAs($buyer, 'sanctum')->getJson("/api/buyer/tenders/{$tenderId}/quotes")->assertOk()->json();
        $this->assertCount(2, $quotes);
        $atlasQuote = Quote::query()->where('supplier_id', $atlas->id)->firstOrFail();

        $orderId = $this->postJson("/api/buyer/quotes/{$atlasQuote->id}/accept")
            ->assertCreated()
            ->assertJsonPath('status', OrderStatus::VALIDATED->value)
            ->json('id');

        // R1 : devis accepté, l'autre refusé, demande clôturée ; plus aucun devis possible.
        $this->assertSame(QuoteStatus::ACCEPTED, $atlasQuote->fresh()->status);
        $this->assertSame(QuoteStatus::REJECTED, Quote::query()->where('supplier_id', $djerba->id)->first()->status);
        $this->assertSame(TenderStatus::CLOSED, Tender::findOrFail($tenderId)->status);
        $this->actingAs($djerba->user, 'sanctum')->putJson("/api/supplier/tenders/{$tenderId}/quote", ['amount' => 3000, 'delivery_days' => 5])
            ->assertStatus(422);

        // 4. Le fournisseur fait avancer la commande, dans l'ordre ; le porteur ne peut pas clôturer avant la livraison.
        $this->actingAs($buyer, 'sanctum')->postJson("/api/buyer/orders/{$orderId}/confirm-receipt")->assertStatus(422);
        $this->actingAs($atlas->user, 'sanctum')->postJson("/api/supplier/orders/{$orderId}/advance")->assertOk();
        $this->postJson("/api/supplier/orders/{$orderId}/advance")->assertOk();
        $this->assertSame(OrderStatus::DELIVERED, Order::findOrFail($orderId)->status);
        $this->postJson("/api/supplier/orders/{$orderId}/advance")->assertStatus(422); // pas d'étape après « livrée »

        // 5. Le porteur confirme la réception : commande clôturée, facture émise.
        $this->actingAs($buyer, 'sanctum')->postJson("/api/buyer/orders/{$orderId}/confirm-receipt")
            ->assertOk()
            ->assertJsonPath('order.status', OrderStatus::CLOSED->value);
        $this->assertDatabaseHas('documents', ['order_id' => $orderId, 'type' => 'facture']);

        // 6. Un seul avis par commande ; la note du fournisseur est mise à jour.
        $this->postJson("/api/buyer/orders/{$orderId}/review", ['rating' => 5, 'comment' => 'Livraison rapide, cartons solides.'])
            ->assertCreated()
            ->assertJsonPath('rating_avg', 5);
        $this->postJson("/api/buyer/orders/{$orderId}/review", ['rating' => 1])->assertStatus(422);
        $this->assertSame(1, (int) $atlas->fresh()->reviews_count);

        // Historique du suivi : chaque étape est tracée.
        $this->assertSame(
            [OrderStatus::VALIDATED->value, OrderStatus::SHIPPED->value, OrderStatus::DELIVERED->value, OrderStatus::CLOSED->value],
            Order::findOrFail($orderId)->statusHistory()->orderBy('id')->pluck('status')->map(fn ($status) => $status->value ?? $status)->all(),
        );
    }
}
