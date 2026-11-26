<?php

namespace Tests\Feature\Admin;

use App\Enums\OrderStatus;
use App\Enums\ProductStatus;
use App\Enums\ReviewStatus;
use App\Models\Product;
use App\Models\Review;
use App\Models\ReviewReport;
use App\Models\SupplierProfile;
use App\Models\User;
use App\Notifications\ProductWithdrawnNotification;
use App\Notifications\ReviewModeratedNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * SCRUM-72 / SCRUM-74 / F29 — modération du catalogue et des avis signalés.
 */
class ModerationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();
    }

    private function admin(): User
    {
        return User::factory()->admin()->create();
    }

    private function supplier(): SupplierProfile
    {
        $user = User::factory()->supplier()->create();

        return $user->supplierProfile()->create([
            'company_name' => 'Atlas',
            'rating_avg' => 3.00,
            'reviews_count' => 2,
        ]);
    }

    private function buyer(): User
    {
        return User::factory()->buyer()->create();
    }

    private function category(): int
    {
        return DB::table('categories')->insertGetId([
            'name' => 'Emballage',
            'position' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function product(SupplierProfile $supplier, int $category, string $status = ProductStatus::PUBLISHED->value): Product
    {
        return Product::create([
            'supplier_id' => $supplier->id,
            'category_id' => $category,
            'type' => 'produit',
            'title' => 'Carton double cannelure',
            'price' => 12.50,
            'status' => $status,
        ]);
    }

    private function review(SupplierProfile $supplier, User $buyer, int $rating, ReviewStatus $status): Review
    {
        $profile = $buyer->buyerProfile()->firstOrCreate([], ['organization' => 'Acheteur']);

        $order = DB::table('orders')->insertGetId([
            'buyer_id' => $profile->id,
            'supplier_id' => $supplier->id,
            'origin' => 'catalogue',
            'total' => 100.00,
            'status' => OrderStatus::CLOSED->value,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return Review::create([
            'order_id' => $order,
            'buyer_id' => $profile->id,
            'supplier_id' => $supplier->id,
            'rating' => $rating,
            'comment' => 'Avis '.$rating,
            'status' => $status,
        ]);
    }

    public function test_les_routes_de_moderation_sont_reservees_a_l_admin(): void
    {
        $this->getJson('/api/admin/products')->assertUnauthorized();

        $this->actingAs(User::factory()->buyer()->create(), 'sanctum')
            ->getJson('/api/admin/products')
            ->assertForbidden();

        $this->actingAs(User::factory()->supplier()->create(), 'sanctum')
            ->getJson('/api/admin/reported-reviews')
            ->assertForbidden();
    }

    public function test_le_catalogue_est_filtrable_par_statut_et_recherche(): void
    {
        $supplier = $this->supplier();
        $category = $this->category();

        $this->product($supplier, $category);
        $this->product($supplier, $category, ProductStatus::WITHDRAWN->value);

        $this->actingAs($this->admin(), 'sanctum')
            ->getJson('/api/admin/products?status='.urlencode(ProductStatus::PUBLISHED->value))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.status', ProductStatus::PUBLISHED->value);

        $this->actingAs($this->admin(), 'sanctum')
            ->getJson('/api/admin/products?q=carton')
            ->assertOk()
            ->assertJsonCount(2, 'data');
    }

    public function test_retirer_un_produit_exige_un_motif_notifie_et_audite(): void
    {
        $admin = $this->admin();
        $supplier = $this->supplier();
        $product = $this->product($supplier, $this->category());

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/products/{$product->id}/withdraw", [])
            ->assertStatus(422)
            ->assertJsonValidationErrors('reason');

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/products/{$product->id}/withdraw", [
                'reason' => 'Allégations non vérifiables sur la fiche',
            ])
            ->assertOk()
            ->assertJsonPath('product.status', ProductStatus::WITHDRAWN->value)
            ->assertJsonPath('product.withdrawal_reason', 'Allégations non vérifiables sur la fiche');

        $this->assertDatabaseHas('audit_logs', [
            'admin_id' => $admin->id,
            'action' => 'product.withdrawn',
            'target' => "product:{$product->id}",
        ]);

        Notification::assertSentTo($supplier->user, ProductWithdrawnNotification::class);

        // Deuxième retrait : conflit métier.
        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/products/{$product->id}/withdraw", ['reason' => 'Doublon'])
            ->assertStatus(422);
    }

    public function test_masquer_un_avis_signalé_recalcule_la_note_et_notifie_l_auteur(): void
    {
        $admin = $this->admin();
        $supplier = $this->supplier();
        $buyer = $this->buyer();

        $good = $this->review($supplier, $buyer, 5, ReviewStatus::PUBLISHED);
        $reported = $this->review($supplier, $buyer, 1, ReviewStatus::REPORTED);

        ReviewReport::create([
            'review_id' => $reported->id,
            'author_id' => $buyer->id,
            'reason' => 'Propos injurieux',
            'status' => ReviewReport::STATUS_PENDING,
        ]);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/reported-reviews')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $reported->id)
            ->assertJsonPath('data.0.reports.0.reason', 'Propos injurieux');

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/reported-reviews/{$reported->id}/hide", [
                'reason' => 'Propos injurieux',
            ])
            ->assertOk()
            ->assertJsonPath('review.status', ReviewStatus::HIDDEN->value)
            ->assertJsonPath('review.supplier.rating_avg', '5.00')
            ->assertJsonPath('review.supplier.reviews_count', 1);

        $this->assertDatabaseHas('reviews', [
            'id' => $reported->id,
            'status' => ReviewStatus::HIDDEN->value,
        ]);
        $this->assertDatabaseHas('review_reports', [
            'review_id' => $reported->id,
            'status' => ReviewReport::STATUS_RESOLVED,
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'admin_id' => $admin->id,
            'action' => 'review.hidden',
            'target' => "review:{$reported->id}",
        ]);
        $this->assertSame(5, $good->fresh()->rating);

        Notification::assertSentTo($buyer, ReviewModeratedNotification::class);
    }

    public function test_conserver_un_avis_signalé_le_republie_et_resout_les_signalements(): void
    {
        $admin = $this->admin();
        $supplier = $this->supplier();
        $buyer = $this->buyer();

        $reported = $this->review($supplier, $buyer, 4, ReviewStatus::REPORTED);
        ReviewReport::create([
            'review_id' => $reported->id,
            'author_id' => $buyer->id,
            'reason' => 'Désaccord commercial',
            'status' => ReviewReport::STATUS_PENDING,
        ]);

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/reported-reviews/{$reported->id}/keep")
            ->assertOk()
            ->assertJsonPath('review.status', ReviewStatus::PUBLISHED->value)
            ->assertJsonPath('review.supplier.rating_avg', '4.00')
            ->assertJsonPath('review.supplier.reviews_count', 1);

        $this->assertDatabaseHas('review_reports', [
            'review_id' => $reported->id,
            'status' => ReviewReport::STATUS_RESOLVED,
            'admin_decision' => 'conservé',
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'admin_id' => $admin->id,
            'action' => 'review.kept',
            'target' => "review:{$reported->id}",
        ]);
    }

    public function test_le_fournisseur_et_l_auteur_sont_prevenus_de_la_decision(): void
    {
        $supplier = $this->supplier();
        $buyer = $this->buyer();
        $review = $this->review($supplier, $buyer, 1, ReviewStatus::REPORTED);

        $this->actingAs($this->admin(), 'sanctum')
            ->postJson("/api/admin/reported-reviews/{$review->id}/hide", ['reason' => 'Propos injurieux'])
            ->assertOk();

        Notification::assertSentTo($buyer, ReviewModeratedNotification::class, fn ($n) => str_starts_with($n->toArray($buyer)['message'], 'Votre avis') && $n->toArray($buyer)['url'] === "/orders/{$review->order_id}");
        Notification::assertSentTo($supplier->user, ReviewModeratedNotification::class, fn ($n) => str_starts_with($n->toArray($supplier->user)['message'], "L'avis reçu") && $n->toArray($supplier->user)['url'] === '/fournisseur/avis');
    }

    public function test_la_file_ne_garde_que_les_avis_a_examiner_les_plus_signales_d_abord(): void
    {
        $supplier = $this->supplier();
        $buyer = $this->buyer();
        $decided = $this->review($supplier, $buyer, 2, ReviewStatus::PUBLISHED);
        $one = $this->review($supplier, $buyer, 2, ReviewStatus::REPORTED);
        $two = $this->review($supplier, $buyer, 2, ReviewStatus::REPORTED);
        $two->update(['ai_suspicion_score' => 82.5]);

        $decided->reports()->create(['author_id' => $supplier->user_id, 'reason' => 'faux_avis', 'status' => ReviewReport::STATUS_RESOLVED]);
        foreach ([[$one, $supplier->user_id], [$two, $supplier->user_id], [$two, $buyer->id]] as [$review, $author]) {
            $review->reports()->create(['author_id' => $author, 'reason' => 'faux_avis', 'status' => ReviewReport::STATUS_PENDING]);
        }

        $this->actingAs($this->admin(), 'sanctum')->getJson('/api/admin/reported-reviews')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $two->id)
            ->assertJsonPath('data.0.ai_suspicion_score', '82.50')
            ->assertJsonPath('data.1.id', $one->id);

        $this->getJson('/api/admin/dashboard')
            ->assertOk()
            ->assertJsonPath('reported_reviews.count', 2)
            ->assertJsonPath('reported_reviews.items.0.id', $two->id)
            ->assertJsonPath('reported_reviews.items.0.reports_count', 2);
    }

    public function test_les_annonces_signalees_par_l_ia_sont_en_premier(): void
    {
        $supplier = $this->supplier();
        $category = $this->category();
        $flagged = $this->product($supplier, $category);
        $flagged->update(['ai_flag_reason' => 'Prix incohérent']);
        $withdrawn = $this->product($supplier, $category, ProductStatus::WITHDRAWN->value);
        $withdrawn->update(['ai_flag_reason' => 'Contrefaçon']);
        $recent = $this->product($supplier, $category);

        $ids = collect($this->actingAs($this->admin(), 'sanctum')->getJson('/api/admin/products')->assertOk()->json('data'))->pluck('id')->all();

        $this->assertSame([$flagged->id, $recent->id, $withdrawn->id], $ids);
    }
}
