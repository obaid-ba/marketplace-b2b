<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Enums\UserRole;
use App\Enums\ValidationStatus;
use App\Models\BuyerProfile;
use App\Models\Document;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatusHistory;
use App\Models\SupplierProfile;
use App\Models\User;
use App\Notifications\OrderClosedNotification;
use App\Services\OrderDocumentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class OrderClosureAndPdfTest extends TestCase
{
    use RefreshDatabase;

    private function createBuyer(string $name = 'Sami Acheteur'): array
    {
        $user = User::factory()->buyer()->create(['name' => $name]);
        $profile = BuyerProfile::create([
            'user_id' => $user->id,
            'organization' => "{$name} Ste",
            'sector' => 'Industrie',
            'city' => 'Tunis',
            'address' => '12 Rue de l\'Industrie',
            'tax_id' => '1234567A/P/M/000',
        ]);

        return [$user, $profile];
    }

    private function createSupplier(string $companyName = 'Quincaillerie Centrale'): array
    {
        $user = User::factory()->supplier()->create();
        $profile = SupplierProfile::factory()->create([
            'user_id' => $user->id,
            'company_name' => $companyName,
            'validation_status' => ValidationStatus::VALIDATED,
            'is_published' => true,
            'tax_id' => '9876543B/A/M/000',
            'rne_number' => '12345678',
            'city' => 'Sfax',
            'address' => 'Zone Industrielle Poudriere',
            'payment_terms' => 'Paiement à la livraison',
        ]);

        return [$user, $profile];
    }

    private function createDeliveredOrder(BuyerProfile $buyer, SupplierProfile $supplier): Order
    {
        $order = Order::create([
            'buyer_id' => $buyer->id,
            'supplier_id' => $supplier->id,
            'origin' => 'catalogue',
            'total' => 600.00,
            'status' => OrderStatus::DELIVERED,
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'label' => 'Meuleuse d\'angle 125mm',
            'quantity' => 2,
            'unit_price' => 300.00,
        ]);

        OrderStatusHistory::create([
            'order_id' => $order->id,
            'status' => OrderStatus::VALIDATED,
            'changed_by' => $buyer->user_id,
            'changed_at' => now()->subHours(5),
        ]);

        OrderStatusHistory::create([
            'order_id' => $order->id,
            'status' => OrderStatus::SHIPPED,
            'changed_by' => $supplier->user_id,
            'changed_at' => now()->subHours(3),
        ]);

        OrderStatusHistory::create([
            'order_id' => $order->id,
            'status' => OrderStatus::DELIVERED,
            'changed_by' => $supplier->user_id,
            'changed_at' => now()->subHour(),
        ]);

        return $order;
    }

    public function test_unauthenticated_user_cannot_confirm_receipt(): void
    {
        [$buyerUser, $buyerProfile] = $this->createBuyer();
        [$supplierUser, $supplierProfile] = $this->createSupplier();
        $order = $this->createDeliveredOrder($buyerProfile, $supplierProfile);

        $response = $this->postJson("/api/buyer/orders/{$order->id}/confirm-receipt");
        $response->assertStatus(401);
    }

    public function test_supplier_cannot_call_confirm_receipt(): void
    {
        [$buyerUser, $buyerProfile] = $this->createBuyer();
        [$supplierUser, $supplierProfile] = $this->createSupplier();
        $order = $this->createDeliveredOrder($buyerProfile, $supplierProfile);

        $response = $this->actingAs($supplierUser)->postJson("/api/buyer/orders/{$order->id}/confirm-receipt");
        $response->assertStatus(403);
    }

    public function test_another_buyer_cannot_confirm_receipt_of_someone_elses_order(): void
    {
        [$buyerUser1, $buyerProfile1] = $this->createBuyer('Acheteur 1');
        [$buyerUser2, $buyerProfile2] = $this->createBuyer('Acheteur 2');
        [$supplierUser, $supplierProfile] = $this->createSupplier();

        $order = $this->createDeliveredOrder($buyerProfile1, $supplierProfile);

        $response = $this->actingAs($buyerUser2)->postJson("/api/buyer/orders/{$order->id}/confirm-receipt");
        $response->assertStatus(403);
    }

    public function test_buyer_cannot_confirm_receipt_if_order_is_not_delivered(): void
    {
        [$buyerUser, $buyerProfile] = $this->createBuyer();
        [$supplierUser, $supplierProfile] = $this->createSupplier();

        // Commande encore au statut "validée"
        $order = Order::create([
            'buyer_id' => $buyerProfile->id,
            'supplier_id' => $supplierProfile->id,
            'origin' => 'catalogue',
            'total' => 300.00,
            'status' => OrderStatus::VALIDATED,
        ]);

        $response = $this->actingAs($buyerUser)->postJson("/api/buyer/orders/{$order->id}/confirm-receipt");
        $response->assertStatus(422)
            ->assertJson([
                'message' => 'La réception ne peut être confirmée que pour une commande livrée.',
            ]);

        // Commande au statut "expédiée"
        $order->update(['status' => OrderStatus::SHIPPED]);

        $response = $this->actingAs($buyerUser)->postJson("/api/buyer/orders/{$order->id}/confirm-receipt");
        $response->assertStatus(422)
            ->assertJson([
                'message' => 'La réception ne peut être confirmée que pour une commande livrée.',
            ]);
    }

    public function test_buyer_confirms_receipt_successfully_closes_order_generates_invoice_and_notifies_supplier(): void
    {
        Storage::fake('local');
        Notification::fake();

        [$buyerUser, $buyerProfile] = $this->createBuyer();
        [$supplierUser, $supplierProfile] = $this->createSupplier();
        $order = $this->createDeliveredOrder($buyerProfile, $supplierProfile);

        $response = $this->actingAs($buyerUser)->postJson("/api/buyer/orders/{$order->id}/confirm-receipt");

        $response->assertStatus(200)
            ->assertJsonPath('order.status', OrderStatus::CLOSED->value)
            ->assertJsonStructure([
                'message',
                'order' => [
                    'id',
                    'status',
                    'status_history',
                    'documents',
                ],
            ]);

        // Vérification de la commande en base
        $order->refresh();
        $this->assertSame(OrderStatus::CLOSED, $order->status);

        // Vérification de l'historique de statut
        $this->assertDatabaseHas('order_status_history', [
            'order_id' => $order->id,
            'status' => OrderStatus::CLOSED->value,
            'changed_by' => $buyerUser->id,
        ]);

        // Vérification de la facture générée
        $invoiceDoc = Document::where('order_id', $order->id)->where('type', 'facture')->first();
        $this->assertNotNull($invoiceDoc);
        $this->assertMatchesRegularExpression('/^FAC-\d{4}-\d{5}$/', $invoiceDoc->number);
        $this->assertTrue(Storage::disk('local')->exists($invoiceDoc->pdf_path));

        // Vérification de la notification envoyée au fournisseur
        Notification::assertSentTo(
            $supplierUser,
            OrderClosedNotification::class,
            function (OrderClosedNotification $notification) use ($order) {
                return $notification->order->id === $order->id;
            }
        );
    }

    public function test_order_document_service_generates_sequential_numbering(): void
    {
        Storage::fake('local');

        [$buyerUser, $buyerProfile] = $this->createBuyer();
        [$supplierUser, $supplierProfile] = $this->createSupplier();

        $order1 = $this->createDeliveredOrder($buyerProfile, $supplierProfile);
        $order2 = $this->createDeliveredOrder($buyerProfile, $supplierProfile);

        $service = app(OrderDocumentService::class);

        $invoice1 = $service->generateInvoicePdf($order1);
        $invoice2 = $service->generateInvoicePdf($order2);

        $year = now()->format('Y');
        $this->assertSame("FAC-{$year}-00001", $invoice1->number);
        $this->assertSame("FAC-{$year}-00002", $invoice2->number);

        // Test devis
        $quote1 = $service->generateQuotePdf($order1);
        $quote2 = $service->generateQuotePdf($order2);

        $this->assertSame("DEV-{$year}-00001", $quote1->number);
        $this->assertSame("DEV-{$year}-00002", $quote2->number);
    }

    public function test_document_download_access_control(): void
    {
        Storage::fake('local');

        [$buyerUser, $buyerProfile] = $this->createBuyer('Acheteur Titulaire');
        [$supplierUser, $supplierProfile] = $this->createSupplier('Fournisseur Titulaire');
        [$otherUser, $otherProfile] = $this->createBuyer('Acheteur Intrus');
        $admin = User::factory()->admin()->create();

        $order = $this->createDeliveredOrder($buyerProfile, $supplierProfile);
        $service = app(OrderDocumentService::class);
        $invoice = $service->generateInvoicePdf($order);

        // 1. Utilisateur non connecté -> 401
        $response = $this->getJson("/api/documents/{$invoice->id}/download");
        $response->assertStatus(401);

        // 2. Utilisateur tiers non concerné -> 403
        $response = $this->actingAs($otherUser)->getJson("/api/documents/{$invoice->id}/download");
        $response->assertStatus(403);

        // 3. Acheteur titulaire -> 200 et téléchargement PDF
        $response = $this->actingAs($buyerUser)->getJson("/api/documents/{$invoice->id}/download");
        $response->assertStatus(200)
            ->assertHeader('content-type', 'application/pdf');

        // 4. Fournisseur concerné -> 200
        $response = $this->actingAs($supplierUser)->getJson("/api/documents/{$invoice->id}/download");
        $response->assertStatus(200)
            ->assertHeader('content-type', 'application/pdf');

        // 5. Administrateur -> 200
        $response = $this->actingAs($admin)->getJson("/api/documents/{$invoice->id}/download");
        $response->assertStatus(200)
            ->assertHeader('content-type', 'application/pdf');

        // 6. Fichier introuvable sur le disque -> 404
        Storage::disk('local')->delete($invoice->pdf_path);
        $response = $this->actingAs($buyerUser)->getJson("/api/documents/{$invoice->id}/download");
        $response->assertStatus(404);
    }
}
