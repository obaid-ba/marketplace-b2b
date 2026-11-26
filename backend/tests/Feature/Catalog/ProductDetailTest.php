<?php

namespace Tests\Feature\Catalog;

use App\Enums\ReviewStatus;
use App\Models\BuyerProfile;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\ProductView;
use App\Models\Region;
use App\Models\Review;
use App\Models\SupplierProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Fiche détaillée d'un produit (SCRUM-36) : GET /api/products/{id}.
 */
class ProductDetailTest extends TestCase
{
    use RefreshDatabase;

    private SupplierProfile $supplier;

    private Product $product;

    protected function setUp(): void
    {
        parent::setUp();

        $parent = Category::factory()->create(['name' => 'Emballage et conditionnement']);
        $category = Category::factory()->childOf($parent)->create(['name' => 'Cartons et caisses']);
        $this->supplier = SupplierProfile::factory()->visible()->create([
            'company_name' => 'Atlas Emballages',
            'region_id' => Region::create(['name' => 'Sfax'])->id,
            'rating_avg' => 4.6,
            'reviews_count' => 38,
        ]);
        $this->product = Product::factory()->published()->for($this->supplier, 'supplier')->create([
            'category_id' => $category->id,
            'title' => 'Cartons ondulés sur mesure',
            'price' => 2.4,
            'unit' => 'pièce',
            'stock' => 12500,
            'availability_days' => 5,
        ]);
    }

    private function url(?Product $product = null): string
    {
        return '/api/products/'.($product ?? $this->product)->id;
    }

    private function review(string $comment, int $daysAgo, ReviewStatus $status = ReviewStatus::PUBLISHED): void
    {
        $user = User::factory()->buyer()->create(['first_name' => 'Sana', 'last_name' => 'Ben Salah']);
        $buyer = BuyerProfile::create(['user_id' => $user->id, 'organization' => 'P']);
        $orderId = DB::table('orders')->insertGetId([
            'buyer_id' => $buyer->id, 'supplier_id' => $this->supplier->id, 'origin' => 'catalogue',
            'total' => 1, 'created_at' => now(), 'updated_at' => now(),
        ]);
        $review = Review::create([
            'order_id' => $orderId, 'buyer_id' => $buyer->id, 'supplier_id' => $this->supplier->id,
            'rating' => 5, 'comment' => $comment, 'status' => $status,
        ]);
        $review->forceFill(['created_at' => now()->subDays($daysAgo)])->save();
    }

    public function test_fiche_visible_sans_connexion(): void
    {
        ProductImage::create(['product_id' => $this->product->id, 'path' => 'b.jpg', 'position' => 2]);
        ProductImage::create(['product_id' => $this->product->id, 'path' => 'a.jpg', 'position' => 1]);

        $this->getJson($this->url())
            ->assertOk()
            ->assertJsonPath('title', 'Cartons ondulés sur mesure')
            ->assertJsonPath('type', 'product')
            ->assertJsonPath('price', 2.4)
            ->assertJsonPath('stock', 12500)
            ->assertJsonPath('in_stock', true)
            ->assertJsonPath('availability_days', 5)
            ->assertJsonPath('category.name', 'Cartons et caisses')
            ->assertJsonPath('category.parent.name', 'Emballage et conditionnement')
            ->assertJsonPath('supplier.company_name', 'Atlas Emballages')
            ->assertJsonPath('supplier.region', 'Sfax')
            ->assertJsonPath('supplier.rating_avg', 4.6)
            ->assertJsonPath('supplier.reviews_count', 38)
            ->assertJsonPath('supplier.is_favorite', false)
            ->assertJsonCount(2, 'images')
            ->assertJson(fn ($json) => $json->where('images.0.url', fn ($url) => str_ends_with($url, 'a.jpg'))->etc());
    }

    public function test_la_fiche_propose_les_autres_produits_du_fournisseur_pour_la_commande_directe(): void
    {
        $this->supplier->update(['delivery_days' => 3, 'payment_terms' => 'Virement']);
        $other = Product::factory()->published()->for($this->supplier, 'supplier')->create(['category_id' => $this->product->category_id]);
        Product::factory()->for($this->supplier, 'supplier')->create(['category_id' => $this->product->category_id]); // brouillon

        $this->getJson($this->url())
            ->assertOk()
            ->assertJsonCount(1, 'same_supplier_products')
            ->assertJsonPath('same_supplier_products.0.id', $other->id)
            ->assertJsonPath('supplier.delivery_days', 3)
            ->assertJsonPath('supplier.payment_terms', 'Virement')
            ->assertJsonMissingPath('supplier.user_id');
    }

    public function test_rupture_de_stock(): void
    {
        $this->product->update(['stock' => 0]);

        $this->getJson($this->url())->assertJsonPath('in_stock', false);
    }

    public function test_un_produit_invisible_renvoie_404(): void
    {
        $category = $this->product->category_id;
        $cases = [
            Product::factory()->for($this->supplier, 'supplier')->create(['category_id' => $category]),
            Product::factory()->withdrawn()->for($this->supplier, 'supplier')->create(['category_id' => $category]),
            Product::factory()->published()->for(SupplierProfile::factory()->pending()->state(['is_published' => true]), 'supplier')->create(['category_id' => $category]),
            Product::factory()->published()->for(SupplierProfile::factory()->visible()->state(['user_id' => User::factory()->supplier()->suspended()]), 'supplier')->create(['category_id' => $category]),
        ];
        $deleted = Product::factory()->published()->for($this->supplier, 'supplier')->create(['category_id' => $category]);
        $deleted->delete();
        $cases[] = $deleted;

        foreach ($cases as $product) {
            $this->getJson($this->url($product))->assertNotFound()->assertJsonPath('message', 'Produit introuvable.');
        }
        $this->getJson('/api/products/999999')->assertNotFound();
        $this->assertSame(0, ProductView::count());
    }

    public function test_les_avis_sont_limites_aux_trois_derniers_publies(): void
    {
        $this->review('Ancien', 30);
        $this->review('Récent 1', 1);
        $this->review('Récent 2', 2);
        $this->review('Récent 3', 3);
        $this->review('Masqué', 0, ReviewStatus::HIDDEN);

        $comments = collect($this->getJson($this->url())->json('latest_reviews'))->pluck('comment');

        $this->assertSame(['Récent 1', 'Récent 2', 'Récent 3'], $comments->all());
    }

    public function test_une_consultation_est_enregistree(): void
    {
        $this->getJson($this->url())->assertOk();

        $this->assertSame(1, ProductView::query()->where('product_id', $this->product->id)->count());
    }

    public function test_une_consultation_rapprochee_du_meme_visiteur_est_ignoree(): void
    {
        $this->getJson($this->url());
        $this->travel(10)->minutes();
        $this->getJson($this->url());
        $this->assertSame(1, ProductView::count());

        $this->travel(31)->minutes();
        $this->getJson($this->url());
        $this->assertSame(2, ProductView::count());
    }

    public function test_deux_visiteurs_differents_comptent_chacun(): void
    {
        $this->getJson($this->url(), ['REMOTE_ADDR' => '10.0.0.1']);
        $this->withServerVariables(['REMOTE_ADDR' => '10.0.0.2'])->getJson($this->url());

        $buyer = User::factory()->buyer()->create();
        Sanctum::actingAs($buyer);
        $this->getJson($this->url());

        $this->assertSame(3, ProductView::count());
        $this->assertSame(1, ProductView::query()->where('user_id', $buyer->id)->count());
    }

    public function test_le_proprietaire_n_est_pas_compte(): void
    {
        Sanctum::actingAs($this->supplier->user);

        $this->getJson($this->url())->assertOk();

        $this->assertSame(0, ProductView::count());
    }

    public function test_is_favorite_du_fournisseur_pour_le_porteur(): void
    {
        $buyer = User::factory()->buyer()->create();
        $buyer->buyerProfile()->create(['organization' => 'X'])->favoriteSuppliers()->attach($this->supplier->id);
        Sanctum::actingAs($buyer);

        $this->getJson($this->url())->assertJsonPath('supplier.is_favorite', true);
    }

    public function test_produits_similaires_via_le_catalogue(): void
    {
        $others = Product::factory()->published()->count(5)->for($this->supplier, 'supplier')
            ->create(['category_id' => $this->product->category_id]);

        $response = $this->getJson("/api/products?category={$this->product->category_id}&exclude={$this->product->id}&per_page=4")
            ->assertJsonCount(4, 'data');

        $this->assertNotContains($this->product->id, collect($response->json('data'))->pluck('id')->all());
        $this->assertCount(5, $others);
    }
}
