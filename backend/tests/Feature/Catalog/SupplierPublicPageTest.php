<?php

namespace Tests\Feature\Catalog;

use App\Enums\ReviewStatus;
use App\Models\BuyerProfile;
use App\Models\Category;
use App\Models\Product;
use App\Models\Region;
use App\Models\Review;
use App\Models\SupplierProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Fiche publique d'un fournisseur (SCRUM-37) : GET /api/suppliers/{id} et /reviews.
 */
class SupplierPublicPageTest extends TestCase
{
    use RefreshDatabase;

    private SupplierProfile $supplier;

    protected function setUp(): void
    {
        parent::setUp();

        $this->supplier = SupplierProfile::factory()->visible()->create([
            'company_name' => 'Atlas Emballages',
            'description' => 'Spécialiste du carton ondulé.',
            'region_id' => Region::create(['name' => 'Sfax'])->id,
            'rating_avg' => 4.6,
            'reviews_count' => 38,
            'tax_id' => '1234567/A',
            'professional_phone' => '+216 74 000 000',
        ]);
        $this->supplier->categories()->attach(Category::factory()->create(['name' => 'Emballage']));
        $this->supplier->coverageRegions()->attach([
            Region::create(['name' => 'Médenine'])->id,
            Region::create(['name' => 'Gabès'])->id,
        ]);
    }

    private function review(array $attributes = [], string $firstName = 'Sana', string $lastName = 'Ben Salah'): Review
    {
        $user = User::factory()->buyer()->create(['first_name' => $firstName, 'last_name' => $lastName]);
        $buyer = BuyerProfile::create(['user_id' => $user->id, 'organization' => 'Projet']);
        $orderId = DB::table('orders')->insertGetId([
            'buyer_id' => $buyer->id, 'supplier_id' => $this->supplier->id, 'origin' => 'catalogue',
            'total' => 100, 'created_at' => now(), 'updated_at' => now(),
        ]);

        return Review::create([
            'order_id' => $orderId, 'buyer_id' => $buyer->id, 'supplier_id' => $this->supplier->id,
            'rating' => 5, 'comment' => 'Livraison rapide.', 'status' => ReviewStatus::PUBLISHED, ...$attributes,
        ]);
    }

    public function test_fiche_visible_sans_connexion(): void
    {
        $category = Category::factory()->create();
        Product::factory()->published()->count(2)->for($this->supplier, 'supplier')->create(['category_id' => $category->id]);
        Product::factory()->for($this->supplier, 'supplier')->create(['category_id' => $category->id]); // brouillon

        $this->getJson("/api/suppliers/{$this->supplier->id}")
            ->assertOk()
            ->assertJsonPath('company_name', 'Atlas Emballages')
            ->assertJsonPath('description', 'Spécialiste du carton ondulé.')
            ->assertJsonPath('region', 'Sfax')
            ->assertJsonPath('categories.0.name', 'Emballage')
            ->assertJsonPath('coverage_regions', ['Médenine', 'Gabès'])
            ->assertJsonPath('rating_avg', 4.6)
            ->assertJsonPath('reviews_count', 38)
            ->assertJsonPath('products_count', 2)
            ->assertJsonPath('is_favorite', false)
            ->assertJsonPath('ai_summary', null);
    }

    public function test_aucune_donnee_privee_n_est_exposee(): void
    {
        $json = $this->getJson("/api/suppliers/{$this->supplier->id}")->json();

        $this->assertEqualsCanonicalizing([
            'id', 'company_name', 'logo_url', 'description', 'sector', 'region', 'categories', 'coverage_regions',
            'is_validated', 'rating_avg', 'reviews_count', 'products_count', 'is_favorite', 'ai_summary',
        ], array_keys($json));
        $this->assertStringNotContainsString('1234567/A', json_encode($json));
        $this->assertStringNotContainsString($this->supplier->user->email, json_encode($json));
    }

    public function test_un_fournisseur_invisible_renvoie_404(): void
    {
        $cases = [
            SupplierProfile::factory()->pending()->create(['is_published' => true]),
            SupplierProfile::factory()->rejected()->create(),
            SupplierProfile::factory()->validated()->create(['is_published' => false]),
            SupplierProfile::factory()->visible()->create(['user_id' => User::factory()->supplier()->suspended()]),
            SupplierProfile::factory()->visible()->create(['user_id' => User::factory()->supplier()->deactivated()]),
        ];
        $deleted = SupplierProfile::factory()->visible()->create();
        $deleted->user->delete();
        $cases[] = $deleted;

        foreach ($cases as $profile) {
            $this->getJson("/api/suppliers/{$profile->id}")->assertNotFound();
            $this->getJson("/api/suppliers/{$profile->id}/reviews")->assertNotFound();
        }
        $this->getJson('/api/suppliers/999999')->assertNotFound();
    }

    public function test_is_favorite_pour_le_porteur_connecte(): void
    {
        $buyer = User::factory()->buyer()->create();
        $buyer->buyerProfile()->create(['organization' => 'X'])->favoriteSuppliers()->attach($this->supplier->id);
        $other = User::factory()->buyer()->create();
        $other->buyerProfile()->create(['organization' => 'Y']);

        Sanctum::actingAs($buyer);
        $this->getJson("/api/suppliers/{$this->supplier->id}")->assertJsonPath('is_favorite', true);

        Sanctum::actingAs($other);
        $this->getJson("/api/suppliers/{$this->supplier->id}")->assertJsonPath('is_favorite', false);

        Sanctum::actingAs($this->supplier->user);
        $this->getJson("/api/suppliers/{$this->supplier->id}")->assertJsonPath('is_favorite', false);
    }

    public function test_avis_publies_avec_reponse_et_auteur_abrege(): void
    {
        $this->review(['rating' => 4, 'comment' => 'Bon rapport qualité-prix.', 'supplier_reply' => 'Merci !', 'created_at' => now()->subDay()]);
        $this->review(['comment' => 'Récent.'], 'Karim', 'Trabelsi');

        $this->getJson("/api/suppliers/{$this->supplier->id}/reviews")
            ->assertOk()
            ->assertJsonPath('meta.total', 2)
            ->assertJsonPath('data.0.author', 'Karim T.')
            ->assertJsonPath('data.0.comment', 'Récent.')
            ->assertJsonPath('data.1.author', 'Sana B.')
            ->assertJsonPath('data.1.rating', 4)
            ->assertJsonPath('data.1.supplier_reply', 'Merci !');
    }

    public function test_les_avis_masques_sont_exclus_et_les_signales_restent_visibles(): void
    {
        $this->review(['comment' => 'Visible']);
        $this->review(['comment' => 'Masqué', 'status' => ReviewStatus::HIDDEN]);
        $this->review(['comment' => 'Signalé', 'status' => ReviewStatus::REPORTED]);

        $comments = collect($this->getJson("/api/suppliers/{$this->supplier->id}/reviews")->json('data'))->pluck('comment');

        // SCRUM-66 : un avis signalé reste visible jusqu'à la décision de l'admin.
        $this->assertEqualsCanonicalizing(['Visible', 'Signalé'], $comments->all());
    }

    public function test_les_avis_ne_contiennent_pas_l_identite_complete(): void
    {
        $this->review();

        $review = $this->getJson("/api/suppliers/{$this->supplier->id}/reviews")->json('data.0');

        $this->assertEqualsCanonicalizing(['id', 'author', 'rating', 'comment', 'supplier_reply', 'created_at'], array_keys($review));
        $this->assertStringNotContainsString('Ben Salah', json_encode($review));
    }

    public function test_produits_du_fournisseur_via_le_catalogue(): void
    {
        $category = Category::factory()->create();
        Product::factory()->published()->for($this->supplier, 'supplier')->create(['category_id' => $category->id, 'title' => 'Mien']);
        Product::factory()->published()->for(SupplierProfile::factory()->visible(), 'supplier')->create(['category_id' => $category->id]);

        $this->getJson("/api/products?supplier_id={$this->supplier->id}")
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.title', 'Mien');
    }
}
