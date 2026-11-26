<?php

namespace Tests\Feature;

use App\Enums\OrderStatus;
use App\Enums\ReviewStatus;
use App\Enums\UserRole;
use App\Enums\ValidationStatus;
use App\Models\BuyerProfile;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderStatusHistory;
use App\Models\Review;
use App\Models\SupplierProfile;
use App\Models\User;
use App\Notifications\ReviewReplyNotification;
use App\Notifications\ReviewSubmittedNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class ReviewTest extends TestCase
{
    use RefreshDatabase;

    private function createBuyer(string $name = 'Sami Acheteur'): array
    {
        $user = User::factory()->buyer()->create(['name' => $name]);
        $profile = BuyerProfile::create([
            'user_id' => $user->id,
            'organization' => "{$name} SARL",
            'sector' => 'BTP',
            'city' => 'Tunis',
        ]);

        return [$user, $profile];
    }

    private function createSupplier(string $companyName = 'Fournisseur Matériaux'): array
    {
        $user = User::factory()->supplier()->create();
        $profile = SupplierProfile::factory()->create([
            'user_id' => $user->id,
            'company_name' => $companyName,
            'validation_status' => ValidationStatus::VALIDATED,
            'is_published' => true,
            'rating_avg' => 0,
            'reviews_count' => 0,
        ]);

        return [$user, $profile];
    }

    private function createOrder(BuyerProfile $buyer, SupplierProfile $supplier, OrderStatus $status = OrderStatus::CLOSED): Order
    {
        $order = Order::create([
            'buyer_id' => $buyer->id,
            'supplier_id' => $supplier->id,
            'origin' => 'catalogue',
            'total' => 450.00,
            'status' => $status,
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'label' => 'Sac de Ciment 50kg',
            'quantity' => 10,
            'unit_price' => 45.00,
        ]);

        OrderStatusHistory::create([
            'order_id' => $order->id,
            'status' => $status,
            'changed_by' => $buyer->user_id,
            'changed_at' => now(),
        ]);

        return $order;
    }

    public function test_cannot_review_order_if_not_closed(): void
    {
        [$buyerUser, $buyerProfile] = $this->createBuyer();
        [$supplierUser, $supplierProfile] = $this->createSupplier();

        // 1. Commande au statut "validée"
        $orderValidated = $this->createOrder($buyerProfile, $supplierProfile, OrderStatus::VALIDATED);
        $res1 = $this->actingAs($buyerUser)->postJson("/api/buyer/orders/{$orderValidated->id}/review", [
            'rating' => 5,
            'comment' => 'Excellent service',
        ]);
        $res1->assertStatus(422)
            ->assertJson([
                'message' => "Vous ne pouvez laisser un avis qu'après avoir confirmé la réception et clôturé la commande.",
            ]);

        // 2. Commande au statut "expédiée"
        $orderShipped = $this->createOrder($buyerProfile, $supplierProfile, OrderStatus::SHIPPED);
        $res2 = $this->actingAs($buyerUser)->postJson("/api/buyer/orders/{$orderShipped->id}/review", [
            'rating' => 4,
            'comment' => 'En cours',
        ]);
        $res2->assertStatus(422);

        // 3. Commande au statut "livrée"
        $orderDelivered = $this->createOrder($buyerProfile, $supplierProfile, OrderStatus::DELIVERED);
        $res3 = $this->actingAs($buyerUser)->postJson("/api/buyer/orders/{$orderDelivered->id}/review", [
            'rating' => 4,
            'comment' => 'Bien reçu mais pas encore clôturé',
        ]);
        $res3->assertStatus(422);
    }

    public function test_another_buyer_cannot_review_order(): void
    {
        [$buyerUser1, $buyerProfile1] = $this->createBuyer('Acheteur 1');
        [$buyerUser2, $buyerProfile2] = $this->createBuyer('Acheteur 2');
        [$supplierUser, $supplierProfile] = $this->createSupplier();

        $order = $this->createOrder($buyerProfile1, $supplierProfile, OrderStatus::CLOSED);

        $res = $this->actingAs($buyerUser2)->postJson("/api/buyer/orders/{$order->id}/review", [
            'rating' => 5,
            'comment' => 'Tentative frauduleuse',
        ]);
        $res->assertStatus(403);
    }

    public function test_buyer_can_submit_review_on_closed_order(): void
    {
        Notification::fake();

        [$buyerUser, $buyerProfile] = $this->createBuyer();
        [$supplierUser, $supplierProfile] = $this->createSupplier();
        $order = $this->createOrder($buyerProfile, $supplierProfile, OrderStatus::CLOSED);

        $response = $this->actingAs($buyerUser)->postJson("/api/buyer/orders/{$order->id}/review", [
            'rating' => 5,
            'comment' => 'Produit conforme et livraison ultra rapide !',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('review.rating', 5)
            ->assertJsonPath('review.comment', 'Produit conforme et livraison ultra rapide !')
            ->assertJsonPath('review.status', ReviewStatus::PUBLISHED->value);

        $this->assertEquals(5.0, $response->json('rating_avg'));

        $this->assertDatabaseHas('reviews', [
            'order_id' => $order->id,
            'buyer_id' => $buyerProfile->id,
            'supplier_id' => $supplierProfile->id,
            'rating' => 5,
            'status' => ReviewStatus::PUBLISHED->value,
        ]);

        $supplierProfile->refresh();
        $this->assertEquals(5.00, $supplierProfile->rating_avg);
        $this->assertEquals(1, $supplierProfile->reviews_count);

        Notification::assertSentTo(
            $supplierUser,
            ReviewSubmittedNotification::class,
            function (ReviewSubmittedNotification $notification) use ($order) {
                return $notification->review->order_id === $order->id;
            }
        );
    }

    public function test_cannot_submit_duplicate_review_on_same_order(): void
    {
        [$buyerUser, $buyerProfile] = $this->createBuyer();
        [$supplierUser, $supplierProfile] = $this->createSupplier();
        $order = $this->createOrder($buyerProfile, $supplierProfile, OrderStatus::CLOSED);

        // Premier avis
        $res1 = $this->actingAs($buyerUser)->postJson("/api/buyer/orders/{$order->id}/review", [
            'rating' => 4,
            'comment' => 'Très bien',
        ]);
        $res1->assertStatus(201);

        // Deuxième avis sur la même commande
        $res2 = $this->actingAs($buyerUser)->postJson("/api/buyer/orders/{$order->id}/review", [
            'rating' => 5,
            'comment' => 'Deuxième avis refusé',
        ]);
        $res2->assertStatus(422)
            ->assertJson([
                'message' => 'Un avis a déjà été déposé pour cette commande.',
            ]);
    }

    public function test_rating_avg_and_reviews_count_recalculated_accurately(): void
    {
        [$buyerUser, $buyerProfile] = $this->createBuyer();
        [$supplierUser, $supplierProfile] = $this->createSupplier();

        // Commande 1 -> Note 5
        $order1 = $this->createOrder($buyerProfile, $supplierProfile, OrderStatus::CLOSED);
        $this->actingAs($buyerUser)->postJson("/api/buyer/orders/{$order1->id}/review", [
            'rating' => 5,
            'comment' => 'Parfait',
        ])->assertStatus(201);

        $supplierProfile->refresh();
        $this->assertEquals(5.00, $supplierProfile->rating_avg);
        $this->assertEquals(1, $supplierProfile->reviews_count);

        // Commande 2 -> Note 2 (moyenne attendue: (5 + 2) / 2 = 3.50)
        $order2 = $this->createOrder($buyerProfile, $supplierProfile, OrderStatus::CLOSED);
        $this->actingAs($buyerUser)->postJson("/api/buyer/orders/{$order2->id}/review", [
            'rating' => 2,
            'comment' => 'Livraison en retard',
        ])->assertStatus(201);

        $supplierProfile->refresh();
        $this->assertEquals(3.50, $supplierProfile->rating_avg);
        $this->assertEquals(2, $supplierProfile->reviews_count);
    }

    public function test_critical_review_alerts_admin_and_flags_notification(): void
    {
        Notification::fake();

        $admin = User::factory()->admin()->create();
        [$buyerUser, $buyerProfile] = $this->createBuyer();
        [$supplierUser, $supplierProfile] = $this->createSupplier();
        $order = $this->createOrder($buyerProfile, $supplierProfile, OrderStatus::CLOSED);

        $response = $this->actingAs($buyerUser)->postJson("/api/buyer/orders/{$order->id}/review", [
            'rating' => 2,
            'comment' => 'Articles endommagés lors de la livraison.',
        ]);
        $response->assertStatus(201);

        // Notification envoyée au fournisseur avec flag critique
        Notification::assertSentTo(
            $supplierUser,
            ReviewSubmittedNotification::class,
            function (ReviewSubmittedNotification $notification) {
                return $notification->review->rating === 2
                    && $notification->toArray($notification->review)['is_critical'] === true;
            }
        );

        // Alerte envoyée à l'administrateur
        Notification::assertSentTo(
            $admin,
            ReviewSubmittedNotification::class,
            function (ReviewSubmittedNotification $notification) {
                return $notification->review->rating === 2;
            }
        );
    }

    public function test_supplier_can_reply_to_review_once(): void
    {
        Notification::fake();

        [$buyerUser, $buyerProfile] = $this->createBuyer();
        [$supplierUser, $supplierProfile] = $this->createSupplier();
        $order = $this->createOrder($buyerProfile, $supplierProfile, OrderStatus::CLOSED);

        $review = Review::create([
            'order_id' => $order->id,
            'buyer_id' => $buyerProfile->id,
            'supplier_id' => $supplierProfile->id,
            'rating' => 3,
            'comment' => 'Délai un peu long.',
            'status' => ReviewStatus::PUBLISHED,
        ]);

        // Fournisseur répond à l'avis
        $res1 = $this->actingAs($supplierUser)->postJson("/api/supplier/reviews/{$review->id}/reply", [
            'reply' => 'Bonjour, nous vous prions de nous excuser pour ce retard exceptionnel.',
        ]);

        $res1->assertStatus(200)
            ->assertJsonPath('review.supplier_reply', 'Bonjour, nous vous prions de nous excuser pour ce retard exceptionnel.');

        $this->assertDatabaseHas('reviews', [
            'id' => $review->id,
            'supplier_reply' => 'Bonjour, nous vous prions de nous excuser pour ce retard exceptionnel.',
        ]);

        // Notification envoyée à l'acheteur
        Notification::assertSentTo(
            $buyerUser,
            ReviewReplyNotification::class,
            function (ReviewReplyNotification $notification) use ($review) {
                return $notification->review->id === $review->id;
            }
        );

        // Deuxième tentative de réponse -> 422
        $res2 = $this->actingAs($supplierUser)->postJson("/api/supplier/reviews/{$review->id}/reply", [
            'reply' => 'Deuxième réponse non autorisée.',
        ]);
        $res2->assertStatus(422)
            ->assertJson([
                'message' => 'Vous avez déjà répondu à cet avis.',
            ]);
    }

    public function test_supplier_cannot_reply_to_another_suppliers_review(): void
    {
        [$buyerUser, $buyerProfile] = $this->createBuyer();
        [$supplierUser1, $supplierProfile1] = $this->createSupplier('Fournisseur 1');
        [$supplierUser2, $supplierProfile2] = $this->createSupplier('Fournisseur 2');

        $order = $this->createOrder($buyerProfile, $supplierProfile1, OrderStatus::CLOSED);
        $review = Review::create([
            'order_id' => $order->id,
            'buyer_id' => $buyerProfile->id,
            'supplier_id' => $supplierProfile1->id,
            'rating' => 4,
            'comment' => 'Bon produit',
            'status' => ReviewStatus::PUBLISHED,
        ]);

        $res = $this->actingAs($supplierUser2)->postJson("/api/supplier/reviews/{$review->id}/reply", [
            'reply' => 'Tentative de réponse sur l\'avis d\'un concurrent',
        ]);
        $res->assertStatus(403);
    }

    public function test_supplier_can_consult_received_reviews_and_statistics(): void
    {
        [$buyerUser, $buyerProfile] = $this->createBuyer();
        [$supplierUser, $supplierProfile] = $this->createSupplier();

        $order1 = $this->createOrder($buyerProfile, $supplierProfile, OrderStatus::CLOSED);
        Review::create([
            'order_id' => $order1->id,
            'buyer_id' => $buyerProfile->id,
            'supplier_id' => $supplierProfile->id,
            'rating' => 5,
            'comment' => 'Top qualité',
            'status' => ReviewStatus::PUBLISHED,
        ]);

        $order2 = $this->createOrder($buyerProfile, $supplierProfile, OrderStatus::CLOSED);
        Review::create([
            'order_id' => $order2->id,
            'buyer_id' => $buyerProfile->id,
            'supplier_id' => $supplierProfile->id,
            'rating' => 4,
            'comment' => 'Très satisfaisant',
            'status' => ReviewStatus::PUBLISHED,
        ]);

        $supplierProfile->update(['rating_avg' => 4.50, 'reviews_count' => 2]);

        $response = $this->actingAs($supplierUser)->getJson('/api/supplier/reviews');
        $response->assertStatus(200)
            ->assertJsonPath('rating_avg', 4.5)
            ->assertJsonPath('reviews_count', 2)
            ->assertJsonPath('star_distribution.5', 1)
            ->assertJsonPath('star_distribution.4', 1)
            ->assertJsonStructure([
                'rating_avg',
                'reviews_count',
                'star_distribution',
                'reviews' => [
                    'data' => [
                        '*' => [
                            'id',
                            'rating',
                            'comment',
                            'buyer',
                            'order',
                        ],
                    ],
                ],
            ]);
    }

    public function test_public_can_view_supplier_published_reviews(): void
    {
        [$buyerUser, $buyerProfile] = $this->createBuyer();
        [$supplierUser, $supplierProfile] = $this->createSupplier();

        $order = $this->createOrder($buyerProfile, $supplierProfile, OrderStatus::CLOSED);
        Review::create([
            'order_id' => $order->id,
            'buyer_id' => $buyerProfile->id,
            'supplier_id' => $supplierProfile->id,
            'rating' => 5,
            'comment' => 'Excellent matériel BTP',
            'supplier_reply' => 'Merci pour votre confiance !',
            'status' => ReviewStatus::PUBLISHED,
        ]);

        $supplierProfile->update(['rating_avg' => 5.00, 'reviews_count' => 1]);

        $response = $this->getJson("/api/suppliers/{$supplierProfile->id}/public-reviews");
        $response->assertStatus(200)
            ->assertJsonPath('reviews_count', 1)
            ->assertJsonCount(1, 'reviews.data')
            ->assertJsonPath('reviews.data.0.supplier_reply', 'Merci pour votre confiance !');

        $this->assertEquals(5.0, $response->json('rating_avg'));
    }
}
