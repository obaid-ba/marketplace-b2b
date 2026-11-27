<?php

namespace Tests\Feature\Supplier;

use App\Enums\OrderStatus;
use App\Enums\ReviewStatus;
use App\Enums\ValidationStatus;
use App\Models\BuyerProfile;
use App\Models\Order;
use App\Models\Review;
use App\Models\SupplierProfile;
use App\Models\User;
use App\Notifications\ReviewReportedNotification;
use App\Services\SupplierRatingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/** SCRUM-66 : signaler un avis abusif. */
class ReviewReportTest extends TestCase
{
    use RefreshDatabase;

    private function makeSupplier(): User
    {
        $user = User::factory()->supplier()->create();
        SupplierProfile::factory()->create([
            'user_id' => $user->id,
            'validation_status' => ValidationStatus::VALIDATED,
            'is_published' => true,
        ]);

        return $user->fresh();
    }

    private function makeReview(User $supplier): Review
    {
        $buyer = BuyerProfile::create([
            'user_id' => User::factory()->buyer()->create()->id,
            'organization' => 'Atelier',
            'sector' => 'BTP',
        ]);
        $order = Order::create([
            'buyer_id' => $buyer->id,
            'supplier_id' => $supplier->supplierProfile->id,
            'origin' => 'catalogue',
            'total' => 100,
            'status' => OrderStatus::CLOSED,
        ]);

        return Review::create([
            'order_id' => $order->id,
            'buyer_id' => $buyer->id,
            'supplier_id' => $supplier->supplierProfile->id,
            'rating' => 1,
            'comment' => 'Honteux',
            'status' => ReviewStatus::PUBLISHED,
        ]);
    }

    public function test_le_fournisseur_signale_un_avis_et_les_admins_sont_prevenus(): void
    {
        Notification::fake();
        $admin = User::factory()->admin()->create();
        $supplier = $this->makeSupplier();
        $review = $this->makeReview($supplier);

        $this->actingAs($supplier, 'sanctum')
            ->postJson("/api/supplier/reviews/{$review->id}/report", ['reason' => 'insultes', 'details' => 'Propos injurieux'])
            ->assertCreated()
            ->assertJsonPath('report.status', 'en attente');

        $this->assertDatabaseHas('review_reports', ['review_id' => $review->id, 'author_id' => $supplier->id, 'reason' => 'insultes', 'details' => 'Propos injurieux']);
        Notification::assertSentTo($admin, ReviewReportedNotification::class);

        $this->getJson('/api/supplier/reviews')->assertJsonPath('reviews.data.0.reports.0.reason', 'insultes');
    }

    public function test_un_avis_signale_reste_visible_jusqu_a_la_decision_de_l_admin(): void
    {
        $supplier = $this->makeSupplier();
        $review = $this->makeReview($supplier);
        $this->actingAs($supplier, 'sanctum')->postJson("/api/supplier/reviews/{$review->id}/report", ['reason' => 'faux_avis'])->assertCreated();

        $this->assertSame(ReviewStatus::REPORTED, $review->fresh()->status);
        $this->getJson('/api/supplier/reviews')->assertJsonPath('reviews_count', 1)->assertJsonPath('reviews.data.0.status', 'signalé');

        // Toujours compté dans la note, puis « publié » s'il est conservé, retiré s'il est masqué.
        app(SupplierRatingService::class)->recompute($supplier->supplierProfile->id);
        $this->assertSame(1, $supplier->supplierProfile->fresh()->reviews_count);
        $admin = User::factory()->admin()->create();
        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/reported-reviews/{$review->id}/keep")->assertOk();
        $this->assertSame(ReviewStatus::PUBLISHED, $review->fresh()->status);
        $this->postJson("/api/admin/reported-reviews/{$review->id}/hide", ['reason' => 'Propos injurieux'])->assertOk();
        $this->assertSame(0, $supplier->supplierProfile->fresh()->reviews_count);

        $this->actingAs($supplier, 'sanctum');
        $review->reports()->delete();
        $this->postJson("/api/supplier/reviews/{$review->id}/report", ['reason' => 'faux_avis'])->assertStatus(422);
        $this->assertSame(ReviewStatus::HIDDEN, $review->fresh()->status);
        $review->update(['status' => ReviewStatus::REPORTED]);
        $this->getJson('/api/suppliers/'.$supplier->supplierProfile->id.'/public-reviews')->assertJsonCount(1, 'reviews.data');
    }

    public function test_un_avis_ne_se_signale_qu_une_fois(): void
    {
        $supplier = $this->makeSupplier();
        $review = $this->makeReview($supplier);
        $url = "/api/supplier/reviews/{$review->id}/report";

        $this->actingAs($supplier, 'sanctum')->postJson($url, ['reason' => 'insultes'])->assertCreated();
        $this->postJson($url, ['reason' => 'hors_sujet'])->assertStatus(422)->assertJsonPath('message', 'Vous avez déjà signalé cet avis.');
        $this->assertDatabaseCount('review_reports', 1);
    }

    public function test_les_signalements_en_attente_deja_enregistres_sont_marques(): void
    {
        $supplier = $this->makeSupplier();
        [$pending, $other] = [$this->makeReview($supplier), $this->makeReview($supplier)];
        $pending->reports()->create(['author_id' => $supplier->id, 'reason' => 'faux_avis', 'status' => 'en attente']);
        $other->reports()->create(['author_id' => $supplier->id, 'reason' => 'faux_avis', 'status' => 'traitée']);

        (require database_path('migrations/2026_11_25_300000_mark_reported_reviews.php'))->up();

        $this->assertSame(ReviewStatus::REPORTED, $pending->fresh()->status);
        $this->assertSame(ReviewStatus::PUBLISHED, $other->fresh()->status);
    }

    public function test_le_motif_est_controle(): void
    {
        $supplier = $this->makeSupplier();
        $url = '/api/supplier/reviews/'.$this->makeReview($supplier)->id.'/report';

        $this->actingAs($supplier, 'sanctum')->postJson($url, [])->assertJsonValidationErrors('reason');
        $this->postJson($url, ['reason' => 'inventé'])->assertJsonValidationErrors('reason');
        $this->postJson($url, ['reason' => 'autre'])->assertJsonValidationErrors('details');
        $this->postJson($url, ['reason' => 'autre', 'details' => 'Chantage'])->assertCreated();
    }

    public function test_seul_le_fournisseur_concerne_peut_signaler(): void
    {
        $review = $this->makeReview($this->makeSupplier());
        $url = "/api/supplier/reviews/{$review->id}/report";

        $this->postJson($url, ['reason' => 'insultes'])->assertUnauthorized();
        $this->actingAs($this->makeSupplier(), 'sanctum')->postJson($url, ['reason' => 'insultes'])->assertForbidden();
        $this->actingAs(User::factory()->buyer()->create(), 'sanctum')->postJson($url, ['reason' => 'insultes'])->assertForbidden();
    }
}
