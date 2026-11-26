<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Enums\ProductStatus;
use App\Enums\UserRole;
use App\Enums\ValidationStatus;
use App\Models\BuyerProfile;
use App\Models\Category;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\Product;
use App\Models\SupplierProfile;
use App\Models\User;
use App\Notifications\NewOrderNotification;
use App\Notifications\OrderValidatedNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class DirectOrderTest extends TestCase
{
    use RefreshDatabase;

    private Category $category;

    protected function setUp(): void
    {
        parent::setUp();

        $this->category = Category::create([
            'name' => 'Outillage & Équipements',
            'position' => 1,
        ]);
    }

    private function createBuyer(): array
    {
        $user = User::factory()->buyer()->create();
        $profile = BuyerProfile::create([
            'user_id' => $user->id,
            'organization' => 'Entreprise Acheteuse SARL',
            'sector' => 'Industrie',
        ]);

        return [$user, $profile];
    }

    private function createValidatedSupplier(string $companyName = 'Fournisseur Validé SARL'): array
    {
        $user = User::factory()->supplier()->create();
        $profile = SupplierProfile::factory()->create([
            'user_id' => $user->id,
            'company_name' => $companyName,
            'validation_status' => ValidationStatus::VALIDATED,
            'is_published' => true,
        ]);

        return [$user, $profile];
    }

    private function createProduct(SupplierProfile $supplier, array $attributes = []): Product
    {
        return Product::create(array_merge([
            'supplier_id' => $supplier->id,
            'category_id' => $this->category->id,
            'type' => 'produit',
            'title' => 'Bétonnière Pro 350L',
            'price' => 1250.00,
            'unit' => 'unité',
            'stock' => 10,
            'status' => ProductStatus::PUBLISHED,
        ], $attributes));
    }

    public function test_un_invite_ne_peut_pas_passer_ni_voir_de_commandes(): void
    {
        $this->postJson('/api/buyer/orders', [
            'items' => [['product_id' => 1, 'quantity' => 1]],
        ])->assertUnauthorized();

        $this->getJson('/api/buyer/orders')->assertUnauthorized();
        $this->getJson('/api/supplier/orders')->assertUnauthorized();
    }

    public function test_un_fournisseur_ne_peut_pas_commander_via_api_buyer(): void
    {
        [$supplierUser] = $this->createValidatedSupplier();

        $this->actingAs($supplierUser)
            ->postJson('/api/buyer/orders', [
                'items' => [['product_id' => 1, 'quantity' => 1]],
            ])
            ->assertForbidden();
    }

    public function test_commande_refusee_si_les_produits_proviennent_de_deux_fournisseurs_differents(): void
    {
        [$buyerUser] = $this->createBuyer();
        [, $supplier1] = $this->createValidatedSupplier('Fournisseur 1');
        [, $supplier2] = $this->createValidatedSupplier('Fournisseur 2');

        $product1 = $this->createProduct($supplier1, ['title' => 'Produit F1', 'price' => 100]);
        $product2 = $this->createProduct($supplier2, ['title' => 'Produit F2', 'price' => 200]);

        $response = $this->actingAs($buyerUser)
            ->postJson('/api/buyer/orders', [
                'items' => [
                    ['product_id' => $product1->id, 'quantity' => 1],
                    ['product_id' => $product2->id, 'quantity' => 2],
                ],
            ]);

        $response->assertStatus(422)
            ->assertJson([
                'message' => "Une commande ne peut contenir que des produits d'un seul fournisseur.",
            ]);
    }

    public function test_commande_refusee_si_le_fournisseur_n_est_pas_valide(): void
    {
        [$buyerUser] = $this->createBuyer();
        $supplierUser = User::factory()->supplier()->create();
        $supplierPending = SupplierProfile::factory()->create([
            'user_id' => $supplierUser->id,
            'company_name' => 'Fournisseur En Attente',
            'validation_status' => ValidationStatus::PENDING,
            'is_published' => false,
        ]);

        $product = $this->createProduct($supplierPending);

        $response = $this->actingAs($buyerUser)
            ->postJson('/api/buyer/orders', [
                'items' => [
                    ['product_id' => $product->id, 'quantity' => 1],
                ],
            ]);

        $response->assertStatus(422)
            ->assertJson([
                'message' => "Le fournisseur n'est pas autorisé à vendre (dossier non validé).",
            ]);
    }

    public function test_commande_refusee_si_produit_non_publie(): void
    {
        [$buyerUser] = $this->createBuyer();
        [, $supplier] = $this->createValidatedSupplier();

        $productDraft = $this->createProduct($supplier, [
            'title' => 'Produit Brouillon',
            'status' => ProductStatus::DRAFT,
        ]);

        $response = $this->actingAs($buyerUser)
            ->postJson('/api/buyer/orders', [
                'items' => [
                    ['product_id' => $productDraft->id, 'quantity' => 1],
                ],
            ]);

        $response->assertStatus(422)
            ->assertJsonFragment([
                'message' => "Le produit « Produit Brouillon » n'est pas disponible à la vente.",
            ]);
    }

    public function test_commande_refusee_si_quantite_superieure_au_stock(): void
    {
        [$buyerUser] = $this->createBuyer();
        [, $supplier] = $this->createValidatedSupplier();

        $product = $this->createProduct($supplier, [
            'title' => 'Perceuse à percussion',
            'price' => 350.00,
            'stock' => 3,
        ]);

        $response = $this->actingAs($buyerUser)
            ->postJson('/api/buyer/orders', [
                'items' => [
                    ['product_id' => $product->id, 'quantity' => 5],
                ],
            ]);

        $response->assertStatus(422)
            ->assertJsonFragment([
                'message' => "Stock insuffisant pour « Perceuse à percussion » : 3 disponible(s), 5 demandé(s).",
                'product_id' => $product->id,
                'available_stock' => 3,
                'requested_quantity' => 5,
            ]);

        // Vérifier qu'aucune commande n'a été créée et le stock est intact
        $this->assertDatabaseCount('orders', 0);
        $this->assertEquals(3, $product->fresh()->stock);
    }

    public function test_creation_reussie_d_une_commande_directe_et_notification(): void
    {
        Notification::fake();

        [$buyerUser, $buyerProfile] = $this->createBuyer();
        [$supplierUser, $supplierProfile] = $this->createValidatedSupplier('Outillage Pro SARL');

        $product1 = $this->createProduct($supplierProfile, [
            'title' => 'Marteau Piqueur',
            'price' => 500.00,
            'stock' => 10,
        ]);
        $product2 = $this->createProduct($supplierProfile, [
            'title' => 'Disqueuse 230mm',
            'price' => 150.00,
            'stock' => 4,
        ]);

        $response = $this->actingAs($buyerUser)
            ->postJson('/api/buyer/orders', [
                'items' => [
                    ['product_id' => $product1->id, 'quantity' => 2],
                    ['product_id' => $product2->id, 'quantity' => 3],
                ],
            ]);

        $response->assertCreated()
            ->assertJsonPath('order.buyer_id', $buyerProfile->id)
            ->assertJsonPath('order.supplier_id', $supplierProfile->id)
            ->assertJsonPath('order.origin', 'catalogue')
            ->assertJsonPath('order.status', 'validée')
            ->assertJsonPath('order.total', '1450.00'); // (2 * 500) + (3 * 150) = 1000 + 450 = 1450

        // Vérification base de données
        $this->assertDatabaseHas('orders', [
            'buyer_id' => $buyerProfile->id,
            'supplier_id' => $supplierProfile->id,
            'origin' => 'catalogue',
            'status' => 'validée',
            'total' => 1450.00,
        ]);

        $order = Order::first();

        // Vérification décrémentation des stocks
        $this->assertEquals(8, $product1->fresh()->stock);
        $this->assertEquals(1, $product2->fresh()->stock);

        // Vérification OrderItems
        $this->assertDatabaseHas('order_items', [
            'order_id' => $order->id,
            'product_id' => $product1->id,
            'label' => 'Marteau Piqueur',
            'quantity' => 2,
            'unit_price' => 500.00,
        ]);
        $this->assertDatabaseHas('order_items', [
            'order_id' => $order->id,
            'product_id' => $product2->id,
            'label' => 'Disqueuse 230mm',
            'quantity' => 3,
            'unit_price' => 150.00,
        ]);

        // Vérification OrderStatusHistory
        $this->assertDatabaseHas('order_status_history', [
            'order_id' => $order->id,
            'status' => OrderStatus::VALIDATED->value,
            'changed_by' => $buyerUser->id,
        ]);

        // Vérification notification
        Notification::assertSentTo($supplierUser, NewOrderNotification::class);
        Notification::assertSentTo($buyerUser, OrderValidatedNotification::class);
    }

    public function test_le_prix_et_la_designation_restent_figes_apres_modification_du_produit(): void
    {
        [$buyerUser] = $this->createBuyer();
        [, $supplierProfile] = $this->createValidatedSupplier();

        $product = $this->createProduct($supplierProfile, [
            'title' => 'Échafaudage Roulant',
            'price' => 800.00,
            'stock' => 5,
        ]);

        // Achat du produit à 800.00 TND
        $response = $this->actingAs($buyerUser)
            ->postJson('/api/buyer/orders', [
                'items' => [
                    ['product_id' => $product->id, 'quantity' => 1],
                ],
            ]);

        $response->assertCreated();
        $order = Order::first();

        // Le fournisseur modifie le produit plus tard (augmente le prix et renomme le titre)
        $product->update([
            'title' => 'Échafaudage Roulant Modèle 2027',
            'price' => 1200.00,
        ]);

        // L'article commandé doit TOUJOURS conserver le libellé et le prix d'origine
        $orderItem = $order->items()->first();
        $this->assertEquals('Échafaudage Roulant', $orderItem->label);
        $this->assertEquals('800.00', $orderItem->unit_price);
        $this->assertEquals('800.00', $order->fresh()->total);
    }

    public function test_filtrage_par_statut_et_cloisonnement_sur_buyer_et_supplier_orders(): void
    {
        [$buyer1, $buyerProfile1] = $this->createBuyer();
        [$buyer2, $buyerProfile2] = $this->createBuyer();
        [$supplier1, $supplierProfile1] = $this->createValidatedSupplier('Fournisseur Alpha');
        [$supplier2, $supplierProfile2] = $this->createValidatedSupplier('Fournisseur Beta');

        // Commande 1 : buyer1 -> supplier1 (statut validée)
        $order1 = Order::create([
            'buyer_id' => $buyerProfile1->id,
            'supplier_id' => $supplierProfile1->id,
            'origin' => 'catalogue',
            'total' => 300.00,
            'status' => OrderStatus::VALIDATED,
        ]);
        OrderStatusHistory::create([
            'order_id' => $order1->id,
            'status' => OrderStatus::VALIDATED,
            'changed_by' => $buyer1->id,
            'changed_at' => now(),
        ]);

        // Commande 2 : buyer1 -> supplier2 (statut expédiée)
        $order2 = Order::create([
            'buyer_id' => $buyerProfile1->id,
            'supplier_id' => $supplierProfile2->id,
            'origin' => 'catalogue',
            'total' => 600.00,
            'status' => OrderStatus::SHIPPED,
        ]);
        OrderStatusHistory::create([
            'order_id' => $order2->id,
            'status' => OrderStatus::SHIPPED,
            'changed_by' => $supplier2->id,
            'changed_at' => now(),
        ]);

        // Commande 3 : buyer2 -> supplier1 (statut validée)
        $order3 = Order::create([
            'buyer_id' => $buyerProfile2->id,
            'supplier_id' => $supplierProfile1->id,
            'origin' => 'catalogue',
            'total' => 900.00,
            'status' => OrderStatus::VALIDATED,
        ]);

        // Test Buyer 1 : voit ses 2 commandes
        $resBuyer1 = $this->actingAs($buyer1)->getJson('/api/buyer/orders');
        $resBuyer1->assertOk()
            ->assertJsonCount(2, 'data');

        // Test Buyer 1 avec filtre statut 'expédiée'
        $resBuyer1Filtered = $this->actingAs($buyer1)->getJson('/api/buyer/orders?status=expédiée');
        $resBuyer1Filtered->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $order2->id);

        // Test Supplier 1 : voit uniquement les commandes qui lui sont destinées (order1 et order3, pas order2)
        $resSupplier1 = $this->actingAs($supplier1)->getJson('/api/supplier/orders');
        $resSupplier1->assertOk()
            ->assertJsonCount(2, 'data');
        $supplierOrderIds = collect($resSupplier1->json('data'))->pluck('id')->all();
        $this->assertContains($order1->id, $supplierOrderIds);
        $this->assertContains($order3->id, $supplierOrderIds);
        $this->assertNotContains($order2->id, $supplierOrderIds);

        // Test consultation détail GET /api/orders/{order}
        // Buyer 1 a accès à order1
        $this->actingAs($buyer1)->getJson("/api/orders/{$order1->id}")->assertOk();
        // Buyer 2 n'a PAS accès à order1
        $this->actingAs($buyer2)->getJson("/api/orders/{$order1->id}")->assertForbidden();
        // Supplier 1 a accès à order1
        $this->actingAs($supplier1)->getJson("/api/orders/{$order1->id}")->assertOk();
        // Supplier 2 n'a PAS accès à order1
        $this->actingAs($supplier2)->getJson("/api/orders/{$order1->id}")->assertForbidden();
    }
}
