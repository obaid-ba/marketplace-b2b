<?php

namespace Tests\Feature\Ai;

use App\Enums\AiFeature;
use App\Enums\OrderStatus;
use App\Enums\ProductStatus;
use App\Enums\ReviewStatus;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\Review;
use App\Models\SupplierProfile;
use App\Models\User;
use App\Services\ReviewInsightService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * IA sur les avis et les annonces (SCRUM-126 / F32) : sentiment et résumé (SCRUM-83), suspicion (SCRUM-84).
 */
class ReviewAiTest extends TestCase
{
    use RefreshDatabase;

    private SupplierProfile $supplier;

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();
        $this->supplier = SupplierProfile::factory()->visible()->create(['company_name' => 'Atlas Emballages']);
    }

    private function buyer(array $attributes = []): User
    {
        $buyer = User::factory()->buyer()->create($attributes);
        $buyer->buyerProfile()->create(['organization' => 'Acheteur']);

        return $buyer;
    }

    private function closedOrder(User $buyer): int
    {
        return DB::table('orders')->insertGetId([
            'buyer_id' => $buyer->buyerProfile->id,
            'supplier_id' => $this->supplier->id,
            'origin' => 'catalogue',
            'total' => 100,
            'status' => OrderStatus::CLOSED->value,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /** Dépose un avis par l'API (le job d'analyse tourne en mode synchrone pendant les tests). */
    private function postReview(int $rating, ?string $comment, ?User $buyer = null): Review
    {
        $buyer ??= $this->buyer(['created_at' => now()->subMonths(6)]);

        $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/buyer/orders/{$this->closedOrder($buyer)}/review", ['rating' => $rating, 'comment' => $comment])
            ->assertCreated();

        return Review::query()->latest('id')->firstOrFail();
    }

    public function test_chaque_nouvel_avis_recoit_un_sentiment_et_un_indice(): void
    {
        $happy = $this->postReview(5, 'Livraison rapide et cartons conformes, équipe très réactive. Je recommande.');
        $angry = $this->postReview(1, 'Gros retard de livraison et cartons abîmés, très déçu.');

        $this->assertSame('positif', $happy->ai_sentiment);
        $this->assertSame('négatif', $angry->ai_sentiment);
        $this->assertEquals(0, $happy->ai_suspicion_score);
        $this->assertSame(ReviewStatus::PUBLISHED, $happy->status);
        $this->assertDatabaseHas('ai_interactions', ['feature' => AiFeature::SENTIMENT->value, 'context' => "review:{$happy->id}"]);
    }

    public function test_un_avis_suspect_est_soumis_a_l_admin_sans_etre_masque(): void
    {
        $burst = $this->buyer(['created_at' => now()]);
        $text = 'Parfait parfait parfait, appelez le 98765432';
        $this->postReview(5, $text, $burst);
        $this->postReview(5, $text, $burst);
        $suspect = $this->postReview(5, $text, $burst);
        $normal = $this->postReview(4, 'Bon rapport qualité-prix, emballage soigné.');

        $this->assertGreaterThanOrEqual(ReviewInsightService::SUSPICION_THRESHOLD, (float) $suspect->ai_suspicion_score);
        $this->assertSame(ReviewStatus::REPORTED, $suspect->status); // visible et compté jusqu'à la décision (D13)
        $this->assertSame(ReviewStatus::PUBLISHED, $normal->status);

        $admin = User::factory()->admin()->create();
        $queue = $this->actingAs($admin, 'sanctum')->getJson('/api/admin/reported-reviews')->assertOk()->json('data');
        $this->assertSame($suspect->id, $queue[0]['id']); // le plus suspect en premier
        $this->assertNotContains($normal->id, array_column($queue, 'id'));

        // L'admin le conserve : il redevient publié et n'est plus réanalysé.
        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/reported-reviews/{$suspect->id}/keep")->assertOk();
        $this->assertSame(ReviewStatus::PUBLISHED, $suspect->fresh()->status);
    }

    public function test_resume_points_forts_et_faibles_a_partir_de_trois_avis(): void
    {
        $this->postReview(5, 'Livraison rapide, équipe réactive.');
        $this->postReview(4, 'Bonne qualité, cartons solides et livraison rapide.');

        $this->getJson("/api/suppliers/{$this->supplier->id}")->assertOk()->assertJsonPath('ai_summary', null);

        $this->postReview(2, 'Retard de livraison et prix trop cher.');

        $summary = $this->getJson("/api/suppliers/{$this->supplier->id}")->assertOk()->json('ai_summary');
        $this->assertSame('Livraison rapide', $summary['strengths'][0]);
        $this->assertContains('Retards de livraison', $summary['weaknesses']);
        $this->assertSame(3, $summary['reviews_count']);
        $this->assertTrue($summary['simulated']);
        $this->assertStringStartsWith('3 avis analysés : 2 positifs', $summary['summary']);

        // Même résumé sur « Mes avis » du fournisseur.
        $this->actingAs($this->supplier->user, 'sanctum')->getJson('/api/supplier/reviews')
            ->assertOk()
            ->assertJsonPath('ai_summary.strengths.0', 'Livraison rapide');
    }

    public function test_un_avis_masque_par_l_admin_sort_du_resume(): void
    {
        $this->postReview(5, 'Livraison rapide.');
        $this->postReview(5, 'Équipe réactive.');
        $this->postReview(5, 'Bonne qualité.');
        $bad = $this->postReview(1, 'Retard énorme, à éviter.');
        $bad->update(['status' => ReviewStatus::REPORTED]);

        $admin = User::factory()->admin()->create();
        $this->actingAs($admin, 'sanctum')->postJson("/api/admin/reported-reviews/{$bad->id}/hide", ['reason' => 'Injurieux'])->assertOk();

        $summary = $this->getJson("/api/suppliers/{$this->supplier->id}")->json('ai_summary');
        $this->assertSame(3, $summary['reviews_count']);
        $this->assertSame([], $summary['weaknesses']);
    }

    public function test_ia_desactivee_l_avis_est_quand_meme_enregistre(): void
    {
        config(['ai.provider' => 'disabled']);

        $review = $this->postReview(5, 'Très bien.');

        $this->assertNull($review->ai_sentiment);
        $this->assertSame(ReviewStatus::PUBLISHED, $review->status);
    }

    private function publishProduct(array $attributes): Product
    {
        Storage::fake(ProductImage::DISK);
        $this->actingAs($this->supplier->user, 'sanctum');

        $id = $this->postJson('/api/supplier/products', [
            'type' => 'product', 'title' => 'Cartons', 'category_id' => $attributes['category_id'],
            'description' => 'Cartons ondulés.', 'price' => 10, 'unit' => 'pièce', 'stock' => 100,
            'availability_days' => 3, 'status' => 'draft', ...$attributes,
        ])->assertCreated()->json('product.id');

        $this->post("/api/supplier/products/{$id}/images", ['images' => [UploadedFile::fake()->image('a.jpg')]], ['Accept' => 'application/json'])->assertCreated();

        $this->putJson("/api/supplier/products/{$id}", [
            'type' => 'product', 'title' => 'Cartons', 'category_id' => $attributes['category_id'],
            'description' => 'Cartons ondulés.', 'price' => 10, 'unit' => 'pièce', 'stock' => 100,
            'availability_days' => 3, ...$attributes, 'status' => 'published',
        ])->assertOk();

        return Product::findOrFail($id);
    }

    public function test_une_annonce_douteuse_est_signalee_et_passe_en_tete_du_controle(): void
    {
        $category = Category::factory()->create();
        foreach ([10, 12, 11] as $price) {
            Product::factory()->published()->for($this->supplier, 'supplier')->create(['category_id' => $category->id, 'price' => $price, 'unit' => 'pièce']);
        }

        $honest = $this->publishProduct(['category_id' => $category->id, 'title' => 'Cartons simples']);
        $doubtful = $this->publishProduct([
            'category_id' => $category->id,
            'title' => 'Cartons réplique',
            'description' => 'Réplique sans facture, contactez-moi au 98 765 432.',
            'price' => 1,
        ]);

        $this->assertNull($honest->ai_flag_reason);
        $this->assertStringContainsString('Coordonnées ou lien', $doubtful->ai_flag_reason);
        $this->assertStringContainsString('contrefaçon', $doubtful->ai_flag_reason);
        $this->assertSame(ProductStatus::PUBLISHED, $doubtful->status); // l'IA ne retire rien

        $admin = User::factory()->admin()->create();
        $this->actingAs($admin, 'sanctum')->getJson('/api/admin/products')->assertOk()->assertJsonPath('data.0.id', $doubtful->id);
    }
}
