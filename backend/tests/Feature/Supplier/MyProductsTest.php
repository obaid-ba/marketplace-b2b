<?php

namespace Tests\Feature\Supplier;

use App\Enums\ProductStatus;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\ProductView;
use App\Models\SupplierProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Gérer la liste de mes produits (SCRUM-34).
 */
class MyProductsTest extends TestCase
{
    use RefreshDatabase;

    private SupplierProfile $supplier;

    private Category $category;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake(ProductImage::DISK);
        $this->category = Category::factory()->create(['name' => 'Emballage']);
        $this->supplier = SupplierProfile::factory()->visible()->create();
    }

    private function product(array $attributes = [], ?SupplierProfile $supplier = null): Product
    {
        return Product::factory()->for($supplier ?? $this->supplier, 'supplier')
            ->create(['category_id' => $this->category->id, ...$attributes]);
    }

    private function order(Product $product): void
    {
        $buyerUser = User::factory()->buyer()->create();
        $buyerId = DB::table('buyer_profiles')->insertGetId([
            'user_id' => $buyerUser->id, 'organization' => 'X', 'created_at' => now(), 'updated_at' => now(),
        ]);
        $orderId = DB::table('orders')->insertGetId([
            'buyer_id' => $buyerId, 'supplier_id' => $product->supplier_id, 'origin' => 'catalogue',
            'total' => 10, 'created_at' => now(), 'updated_at' => now(),
        ]);
        DB::table('order_items')->insert([
            'order_id' => $orderId, 'product_id' => $product->id, 'label' => $product->title,
            'quantity' => 1, 'unit_price' => 10, 'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    public function test_acces_reserve_au_fournisseur_valide(): void
    {
        $this->getJson('/api/supplier/products')->assertUnauthorized();

        Sanctum::actingAs(User::factory()->buyer()->create());
        $this->getJson('/api/supplier/products')->assertForbidden();

        Sanctum::actingAs(SupplierProfile::factory()->pending()->create()->user);
        $this->getJson('/api/supplier/products')->assertForbidden();
    }

    public function test_liste_uniquement_mes_produits_avec_compteurs_et_vues(): void
    {
        $published = $this->product(['title' => 'Publié', 'status' => ProductStatus::PUBLISHED]);
        $this->product(['title' => 'Brouillon']);
        $this->product(['title' => 'Retiré', 'status' => ProductStatus::WITHDRAWN, 'withdrawal_reason' => 'Motif']);
        $this->product(['title' => 'Autre fournisseur'], SupplierProfile::factory()->visible()->create());
        ProductView::insert([
            ['product_id' => $published->id, 'viewed_at' => now()],
            ['product_id' => $published->id, 'viewed_at' => now()],
        ]);
        Sanctum::actingAs($this->supplier->user);

        $response = $this->getJson('/api/supplier/products')
            ->assertOk()
            ->assertJsonPath('meta.total', 3)
            ->assertJsonPath('meta.per_page', 10)
            ->assertJsonPath('counts', ['all' => 3, 'draft' => 1, 'published' => 1, 'withdrawn' => 1]);

        $rows = collect($response->json('data'))->keyBy('title');
        $this->assertSame(2, $rows['Publié']['views_count']);
        $this->assertSame(0, $rows['Brouillon']['views_count']);
        $this->assertSame('Emballage', $rows['Publié']['category']['name']);
        $this->assertSame('Motif', $rows['Retiré']['withdrawal_reason']);
        $this->assertArrayNotHasKey('Autre fournisseur', $rows->all());
    }

    public function test_filtre_par_statut_sans_changer_les_compteurs(): void
    {
        $this->product(['title' => 'Publié', 'status' => ProductStatus::PUBLISHED]);
        $this->product(['title' => 'Brouillon']);
        Sanctum::actingAs($this->supplier->user);

        $this->getJson('/api/supplier/products?status=draft')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Brouillon')
            ->assertJsonPath('counts.all', 2);

        $this->getJson('/api/supplier/products?status=inconnu')->assertUnprocessable();
    }

    public function test_filtre_par_categorie_inclut_les_sous_categories(): void
    {
        $child = Category::factory()->childOf($this->category)->create();
        $other = Category::factory()->create();
        $this->product(['title' => 'Parent']);
        $this->product(['title' => 'Enfant', 'category_id' => $child->id]);
        $this->product(['title' => 'Autre', 'category_id' => $other->id]);
        Sanctum::actingAs($this->supplier->user);

        $titles = collect($this->getJson("/api/supplier/products?category_id={$this->category->id}")->json('data'))->pluck('title');
        $this->assertEqualsCanonicalizing(['Parent', 'Enfant'], $titles->all());
        $this->getJson("/api/supplier/products?category_id={$other->id}")->assertJsonPath('counts.all', 1);
    }

    public function test_pagination_par_dix(): void
    {
        Product::factory()->count(12)->for($this->supplier, 'supplier')->create(['category_id' => $this->category->id]);
        Sanctum::actingAs($this->supplier->user);

        $this->getJson('/api/supplier/products?page=2')
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.last_page', 2);
    }

    public function test_depublier_un_produit(): void
    {
        $product = $this->product(['status' => ProductStatus::PUBLISHED]);
        Sanctum::actingAs($this->supplier->user);

        $this->patchJson("/api/supplier/products/{$product->id}/unpublish")
            ->assertOk()
            ->assertJsonPath('product.status', 'draft');

        $this->assertSame(ProductStatus::DRAFT, $product->fresh()->status);
    }

    public function test_un_produit_retire_ne_peut_pas_etre_depublie(): void
    {
        $product = $this->product(['status' => ProductStatus::WITHDRAWN]);
        Sanctum::actingAs($this->supplier->user);

        $this->patchJson("/api/supplier/products/{$product->id}/unpublish")->assertUnprocessable();
        $this->assertSame(ProductStatus::WITHDRAWN, $product->fresh()->status);
    }

    public function test_suppression_definitive_d_un_produit_jamais_commande(): void
    {
        $product = $this->product();
        $image = ProductImage::create(['product_id' => $product->id, 'path' => 'products/x.jpg', 'position' => 1]);
        Storage::disk(ProductImage::DISK)->put('products/x.jpg', 'x');
        Sanctum::actingAs($this->supplier->user);

        $this->deleteJson("/api/supplier/products/{$product->id}")
            ->assertOk()
            ->assertJsonPath('permanent', true);

        $this->assertNull(Product::withTrashed()->find($product->id));
        $this->assertModelMissing($image);
        Storage::disk(ProductImage::DISK)->assertMissing('products/x.jpg');
    }

    public function test_un_produit_deja_commande_n_est_pas_supprime_physiquement(): void
    {
        $product = $this->product(['status' => ProductStatus::PUBLISHED]);
        $this->order($product);
        Sanctum::actingAs($this->supplier->user);

        $this->deleteJson("/api/supplier/products/{$product->id}")
            ->assertOk()
            ->assertJsonPath('permanent', false);

        $this->assertSoftDeleted($product);
        $this->assertDatabaseHas('order_items', ['product_id' => $product->id]);
        // Retiré du catalogue public et de « Mes produits ».
        $this->getJson('/api/products')->assertJsonPath('meta.total', 0);
        $this->getJson('/api/supplier/products')->assertJsonPath('meta.total', 0);
    }

    public function test_seul_le_proprietaire_depublie_ou_supprime(): void
    {
        $product = $this->product(['status' => ProductStatus::PUBLISHED], SupplierProfile::factory()->visible()->create());
        Sanctum::actingAs($this->supplier->user);

        $this->patchJson("/api/supplier/products/{$product->id}/unpublish")->assertForbidden();
        $this->deleteJson("/api/supplier/products/{$product->id}")->assertForbidden();
        $this->assertModelExists($product);
    }
}
