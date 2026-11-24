<?php

namespace Tests\Feature\Supplier;

use App\Enums\OrderStatus;
use App\Enums\ProductStatus;
use App\Enums\QuoteStatus;
use App\Enums\ReviewStatus;
use App\Enums\TenderStatus;
use App\Enums\ValidationStatus;
use App\Models\BuyerProfile;
use App\Models\SupplierProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * SCRUM-120 / F26 — tableau de bord fournisseur (story SCRUM-68).
 */
class SupplierDashboardTest extends TestCase
{
    use RefreshDatabase;

    private function supplier(): SupplierProfile
    {
        $user = User::factory()->supplier()->create();

        return $user->supplierProfile()->create([
            'company_name' => 'Atlas',
            'validation_status' => ValidationStatus::VALIDATED->value,
            'is_published' => true,
            'rating_avg' => 4.25,
            'reviews_count' => 2,
        ]);
    }

    private function buyer(): BuyerProfile
    {
        return User::factory()->buyer()->create()->buyerProfile()->create(['organization' => 'Acheteur']);
    }

    public function test_un_visiteur_et_les_autres_roles_n_accedent_pas_au_tableau_de_bord(): void
    {
        $this->getJson('/api/supplier/dashboard')->assertUnauthorized();

        $this->actingAs(User::factory()->buyer()->create(), 'sanctum')
            ->getJson('/api/supplier/dashboard')
            ->assertForbidden();

        $this->actingAs(User::factory()->admin()->create(), 'sanctum')
            ->getJson('/api/supplier/dashboard')
            ->assertForbidden();
    }

    public function test_un_fournisseur_en_attente_voit_un_tableau_de_bord_vide(): void
    {
        $user = User::factory()->supplier()->create();
        $user->supplierProfile()->create([
            'company_name' => 'En attente',
            'validation_status' => ValidationStatus::PENDING->value,
        ]);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/supplier/dashboard')
            ->assertOk()
            ->assertJsonPath('kpis.revenue', '0.00')
            ->assertJsonPath('kpis.orders_count', 0)
            ->assertJsonPath('kpis.accepted_quote_rate', 0)
            ->assertJsonPath('negative_review_alert.active', false);
    }

    public function test_les_indicateurs_les_produits_et_les_demandes_sont_agreges(): void
    {
        $supplier = $this->supplier();
        $buyer = $this->buyer();
        $user = $supplier->user;

        $category = DB::table('categories')->insertGetId([
            'name' => 'Emballage',
            'position' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $product = DB::table('products')->insertGetId([
            'supplier_id' => $supplier->id,
            'category_id' => $category,
            'type' => 'produit',
            'title' => 'Carton double cannelure',
            'price' => 12.50,
            'stock' => 100,
            'status' => ProductStatus::PUBLISHED->value,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $baseOrder = [
            'buyer_id' => $buyer->id,
            'supplier_id' => $supplier->id,
            'origin' => 'catalogue',
            'created_at' => '2027-01-10 10:00:00',
            'updated_at' => '2027-01-10 10:00:00',
        ];

        $closedOrder = DB::table('orders')->insertGetId($baseOrder + [
            'total' => 800.00,
            'status' => OrderStatus::CLOSED->value,
        ]);
        DB::table('orders')->insert($baseOrder + [
            'total' => 200.00,
            'status' => OrderStatus::VALIDATED->value,
        ]);
        // Hors période.
        $outsideOrder = DB::table('orders')->insertGetId(array_merge($baseOrder, [
            'total' => 999.00,
            'status' => OrderStatus::CLOSED->value,
            'created_at' => '2026-12-10 10:00:00',
            'updated_at' => '2026-12-10 10:00:00',
        ]));

        DB::table('order_items')->insert([
            'order_id' => $closedOrder,
            'product_id' => $product,
            'label' => 'Carton double cannelure',
            'quantity' => 40,
            'unit_price' => 12.50,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Trois consultations sur la période, une hors période.
        foreach (['2027-01-10', '2027-01-11', '2027-01-12'] as $day) {
            DB::table('product_views')->insert([
                'product_id' => $product,
                'user_id' => $buyer->user_id,
                'viewed_at' => $day.' 09:00:00',
            ]);
        }
        DB::table('product_views')->insert([
            'product_id' => $product,
            'user_id' => $buyer->user_id,
            'viewed_at' => '2026-12-20 09:00:00',
        ]);

        // Devis : un accepté et un envoyé sur la période, sur deux demandes
        // distinctes (un fournisseur ne dépose qu'un devis par demande) ;
        // un devis rejeté hors période.
        $openTender = DB::table('tenders')->insertGetId([
            'buyer_id' => $buyer->id,
            'title' => 'Demande de cartons',
            'description' => 'Description',
            'category_id' => $category,
            'status' => TenderStatus::OPEN->value,
            'created_at' => '2027-01-04 10:00:00',
            'updated_at' => '2027-01-04 10:00:00',
        ]);

        $secondTender = DB::table('tenders')->insertGetId([
            'buyer_id' => $buyer->id,
            'title' => 'Deuxième demande',
            'description' => 'Description',
            'category_id' => $category,
            'status' => TenderStatus::OPEN->value,
            'created_at' => '2027-01-05 10:00:00',
            'updated_at' => '2027-01-05 10:00:00',
        ]);

        foreach ([[$openTender, QuoteStatus::ACCEPTED, '2027-01-06'], [$secondTender, QuoteStatus::SENT, '2027-01-07']] as [$tenderId, $status, $day]) {
            DB::table('quotes')->insert([
                'tender_id' => $tenderId,
                'supplier_id' => $supplier->id,
                'amount' => 1500.00,
                'delivery_days' => 5,
                'status' => $status->value,
                'created_at' => $day.' 10:00:00',
                'updated_at' => $day.' 10:00:00',
            ]);
        }

        // Devis rejeté hors période déposé par un autre fournisseur (la contrainte
        // d'unicité interdit deux devis du même fournisseur sur une demande).
        $otherSupplier = User::factory()->supplier()->create()->supplierProfile()->create([
            'company_name' => 'Autre fournisseur',
        ]);

        DB::table('quotes')->insert([
            'tender_id' => $openTender,
            'supplier_id' => $otherSupplier->id,
            'amount' => 1500.00,
            'delivery_days' => 5,
            'status' => QuoteStatus::REJECTED->value,
            'created_at' => '2026-12-06 10:00:00',
            'updated_at' => '2026-12-06 10:00:00',
        ]);

        // Demandes reçues : scores 90 puis 20 (tri par pertinence).
        $important = DB::table('tenders')->insertGetId([
            'buyer_id' => $buyer->id,
            'title' => 'Demande prioritaire',
            'description' => 'Description',
            'category_id' => $category,
            'status' => TenderStatus::OPEN->value,
            'budget' => 5000.00,
            'desired_deadline' => '2027-02-01',
            'created_at' => '2027-01-03 10:00:00',
            'updated_at' => '2027-01-03 10:00:00',
        ]);

        DB::table('tender_recipients')->insert([
            ['tender_id' => $important, 'supplier_id' => $supplier->id, 'score' => 90.00, 'source' => 'automatique', 'created_at' => now(), 'updated_at' => now()],
            ['tender_id' => $openTender, 'supplier_id' => $supplier->id, 'score' => 20.00, 'source' => 'automatique', 'created_at' => now(), 'updated_at' => now()],
        ]);

        // Avis publiés : une note basse (alerte) et une note haute, sur deux
        // commandes distinctes (une commande ne reçoit qu'un avis).
        foreach ([[1, '2027-01-09', $closedOrder], [5, '2027-01-10', $outsideOrder]] as [$rating, $day, $reviewOrderId]) {
            DB::table('reviews')->insert([
                'order_id' => $reviewOrderId,
                'buyer_id' => $buyer->id,
                'supplier_id' => $supplier->id,
                'rating' => $rating,
                'comment' => 'Commentaire '.$rating,
                'status' => ReviewStatus::PUBLISHED->value,
                'created_at' => $day.' 12:00:00',
                'updated_at' => $day.' 12:00:00',
            ]);
        }

        // Deux notifications non lues.
        foreach ([1, 2] as $index) {
            DB::table('notifications')->insert([
                'id' => (string) Str::uuid(),
                'type' => 'App\\Notifications\\NewOrderNotification',
                'notifiable_type' => User::class,
                'notifiable_id' => $user->id,
                'data' => json_encode(['message' => "Notification {$index}"]),
                'read_at' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/supplier/dashboard?from=2027-01-01&to=2027-01-31')
            ->assertOk()
            ->assertJsonPath('period.days', 31)
            ->assertJsonPath('kpis.revenue', '800.00')
            ->assertJsonPath('kpis.orders_count', 2)
            ->assertJsonPath('kpis.orders_in_progress', 1)
            ->assertJsonPath('kpis.orders_finished', 1)
            ->assertJsonPath('kpis.quotes_count', 2)
            ->assertJsonPath('kpis.accepted_quote_rate', 50)
            ->assertJsonPath('kpis.average_rating', 4.25)
            ->assertJsonPath('kpis.reviews_count', 2)
            ->assertJsonPath('kpis.views_count', 3)
            ->assertJsonPath('kpis.unread_items', 2)
            ->assertJsonPath('negative_review_alert.active', true)
            ->assertJsonPath('negative_review_alert.count', 1)
            ->assertJsonPath('most_viewed_products.0.title', 'Carton double cannelure')
            ->assertJsonPath('most_viewed_products.0.views_count', 3)
            ->assertJsonPath('most_sold_products.0.quantity_sold', 40)
            ->assertJsonPath('open_requests.0.title', 'Demande prioritaire')
            ->assertJsonPath('open_requests.0.score', 90)
            ->assertJsonCount(2, 'latest_reviews')
            ->assertJsonCount(31, 'series');
    }
}
