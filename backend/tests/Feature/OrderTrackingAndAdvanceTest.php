<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Enums\UserRole;
use App\Enums\ValidationStatus;
use App\Models\BuyerProfile;
use App\Models\Category;
use App\Models\Document;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatusHistory;
use App\Models\SupplierProfile;
use App\Models\User;
use App\Notifications\OrderStatusUpdatedNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class OrderTrackingAndAdvanceTest extends TestCase
{
    use RefreshDatabase;

    private function createBuyer(string $name = 'Acheteur Test'): array
    {
        $user = User::factory()->buyer()->create(['name' => $name]);
        $profile = BuyerProfile::create([
            'user_id' => $user->id,
            'organization' => "{$name} Entreprise",
            'sector' => 'BTP',
            'city' => 'Tunis',
        ]);

        return [$user, $profile];
    }

    private function createSupplier(string $companyName = 'Fournisseur Test SARL'): array
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

    private function createOrder(BuyerProfile $buyer, SupplierProfile $supplier, OrderStatus $status = OrderStatus::VALIDATED): Order
    {
        $order = Order::create([
            'buyer_id' => $buyer->id,
            'supplier_id' => $supplier->id,
            'origin' => 'catalogue',
            'total' => 500.00,
            'status' => $status,
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'label' => 'Perceuse Bosch 750W',
            'quantity' => 2,
            'unit_price' => 250.00,
        ]);

        OrderStatusHistory::create([
            'order_id' => $order->id,
            'status' => OrderStatus::VALIDATED,
            'changed_by' => $buyer->user_id,
            'changed_at' => now()->subHours(2),
        ]);

        if ($status === OrderStatus::SHIPPED || $status === OrderStatus::DELIVERED || $status === OrderStatus::CLOSED) {
            OrderStatusHistory::create([
                'order_id' => $order->id,
                'status' => OrderStatus::SHIPPED,
                'changed_by' => $supplier->user_id,
                'changed_at' => now()->subHour(),
            ]);
        }

        if ($status === OrderStatus::DELIVERED || $status === OrderStatus::CLOSED) {
            OrderStatusHistory::create([
                'order_id' => $order->id,
                'status' => OrderStatus::DELIVERED,
                'changed_by' => $supplier->user_id,
                'changed_at' => now()->subMinutes(30),
            ]);
        }

        if ($status === OrderStatus::CLOSED) {
            OrderStatusHistory::create([
                'order_id' => $order->id,
                'status' => OrderStatus::CLOSED,
                'changed_by' => $buyer->user_id,
                'changed_at' => now(),
            ]);
        }

        return $order;
    }

    public function test_visiteur_non_authentifie_recoit_401(): void
    {
        $this->getJson('/api/orders/1')->assertUnauthorized();
        $this->postJson('/api/supplier/orders/1/advance')->assertUnauthorized();
    }

    public function test_seules_les_parties_de_la_commande_ou_admin_peuvent_consulter_le_detail(): void
    {
        [$buyer1, $buyerProfile1] = $this->createBuyer('Acheteur 1');
        [$buyer2] = $this->createBuyer('Acheteur 2');

        [$supplier1, $supplierProfile1] = $this->createSupplier('Fournisseur 1');
        [$supplier2] = $this->createSupplier('Fournisseur 2');

        $admin = User::factory()->admin()->create();

        $order = $this->createOrder($buyerProfile1, $supplierProfile1);

        // L'acheteur propriétaire a accès (200)
        $this->actingAs($buyer1)
            ->getJson("/api/orders/{$order->id}")
            ->assertOk();

        // Le fournisseur destinataire a accès (200)
        $this->actingAs($supplier1)
            ->getJson("/api/orders/{$order->id}")
            ->assertOk();

        // L'administrateur a accès (200)
        $this->actingAs($admin)
            ->getJson("/api/orders/{$order->id}")
            ->assertOk();

        // Un autre acheteur reçoit 403 Forbidden
        $this->actingAs($buyer2)
            ->getJson("/api/orders/{$order->id}")
            ->assertForbidden();

        // Un autre fournisseur reçoit 403 Forbidden
        $this->actingAs($supplier2)
            ->getJson("/api/orders/{$order->id}")
            ->assertForbidden();
    }

    public function test_le_detail_de_commande_contient_items_status_history_documents_et_contacts(): void
    {
        [$buyer, $buyerProfile] = $this->createBuyer('Société Acheteuse');
        [$supplier, $supplierProfile] = $this->createSupplier('Société Fournisseuse');

        $order = $this->createOrder($buyerProfile, $supplierProfile, OrderStatus::SHIPPED);

        Document::create([
            'order_id' => $order->id,
            'type' => 'facture',
            'number' => 'FAC-2026-999',
            'pdf_path' => 'documents/orders/fac-999.pdf',
        ]);

        $response = $this->actingAs($buyer)->getJson("/api/orders/{$order->id}");

        $response->assertOk()
            ->assertJsonPath('order.id', $order->id)
            ->assertJsonPath('order.total', '500.00')
            ->assertJsonPath('order.status', 'expédiée')
            ->assertJsonPath('order.items.0.label', 'Perceuse Bosch 750W')
            ->assertJsonPath('order.items.0.quantity', 2)
            ->assertJsonPath('order.items.0.unit_price', '250.00')
            ->assertJsonPath('order.items.0.line_total', '500.00')
            ->assertJsonPath('order.buyer.organization', 'Société Acheteuse Entreprise')
            ->assertJsonPath('order.supplier.company_name', 'Société Fournisseuse')
            ->assertJsonPath('order.documents.0.number', 'FAC-2026-999')
            ->assertJsonCount(2, 'order.status_history');
    }

    public function test_le_fournisseur_fait_avancer_la_commande_de_validee_a_expediee_puis_a_livree(): void
    {
        Notification::fake();

        [$buyer, $buyerProfile] = $this->createBuyer('Client');
        [$supplier, $supplierProfile] = $this->createSupplier('Vendeur Pro');

        $order = $this->createOrder($buyerProfile, $supplierProfile, OrderStatus::VALIDATED);

        // 1ère transition : validée -> expédiée
        $res1 = $this->actingAs($supplier)
            ->postJson("/api/supplier/orders/{$order->id}/advance");

        $res1->assertOk()
            ->assertJsonPath('order.status', 'expédiée')
            ->assertJsonPath('message', 'Statut de la commande mis à jour vers « expédiée ».');

        $this->assertEquals(OrderStatus::SHIPPED, $order->fresh()->status);

        $this->assertDatabaseHas('order_status_history', [
            'order_id' => $order->id,
            'status' => 'expédiée',
            'changed_by' => $supplier->id,
        ]);

        Notification::assertSentTo($buyer, OrderStatusUpdatedNotification::class, function ($notification) use ($order) {
            return $notification->order->id === $order->id && $notification->order->status === OrderStatus::SHIPPED;
        });

        // 2ème transition : expédiée -> livrée
        $res2 = $this->actingAs($supplier)
            ->postJson("/api/supplier/orders/{$order->id}/advance");

        $res2->assertOk()
            ->assertJsonPath('order.status', 'livrée')
            ->assertJsonPath('message', 'Statut de la commande mis à jour vers « livrée ».');

        $this->assertEquals(OrderStatus::DELIVERED, $order->fresh()->status);

        $this->assertDatabaseHas('order_status_history', [
            'order_id' => $order->id,
            'status' => 'livrée',
            'changed_by' => $supplier->id,
        ]);

        Notification::assertSentTo($buyer, OrderStatusUpdatedNotification::class, function ($notification) use ($order) {
            return $notification->order->id === $order->id && $notification->order->status === OrderStatus::DELIVERED;
        });
    }

    public function test_un_fournisseur_non_destinataire_ne_peut_pas_faire_avancer_la_commande(): void
    {
        [, $buyerProfile] = $this->createBuyer();
        [, $supplierProfile1] = $this->createSupplier('Fournisseur 1');
        [$supplier2] = $this->createSupplier('Fournisseur 2');

        $order = $this->createOrder($buyerProfile, $supplierProfile1, OrderStatus::VALIDATED);

        $this->actingAs($supplier2)
            ->postJson("/api/supplier/orders/{$order->id}/advance")
            ->assertForbidden();
    }

    public function test_un_acheteur_ne_peut_pas_appeler_l_endpoint_fournisseur_advance(): void
    {
        [$buyer, $buyerProfile] = $this->createBuyer();
        [, $supplierProfile] = $this->createSupplier();

        $order = $this->createOrder($buyerProfile, $supplierProfile, OrderStatus::VALIDATED);

        $this->actingAs($buyer)
            ->postJson("/api/supplier/orders/{$order->id}/advance")
            ->assertForbidden();
    }

    public function test_rejet_422_si_commande_deja_livree_ou_cloturee(): void
    {
        [, $buyerProfile] = $this->createBuyer();
        [$supplier, $supplierProfile] = $this->createSupplier();

        // Commande livrée : le fournisseur ne peut pas la clôturer lui-même
        $orderDelivered = $this->createOrder($buyerProfile, $supplierProfile, OrderStatus::DELIVERED);

        $this->actingAs($supplier)
            ->postJson("/api/supplier/orders/{$orderDelivered->id}/advance")
            ->assertStatus(422)
            ->assertJson([
                'message' => "Transition de statut non autorisée depuis l'état actuel.",
            ]);

        // Commande déjà clôturée
        $orderClosed = $this->createOrder($buyerProfile, $supplierProfile, OrderStatus::CLOSED);

        $this->actingAs($supplier)
            ->postJson("/api/supplier/orders/{$orderClosed->id}/advance")
            ->assertStatus(422)
            ->assertJson([
                'message' => "Transition de statut non autorisée depuis l'état actuel.",
            ]);
    }
}
