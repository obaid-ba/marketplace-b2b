<?php

namespace Tests\Feature\Supplier;

use App\Enums\ProductStatus;
use App\Models\Category;
use App\Models\Product;
use App\Models\SupplierProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Mettre un produit en avant pour une durée limitée (SCRUM-40).
 */
class FeaturedProductTest extends TestCase
{
    use RefreshDatabase;

    private SupplierProfile $supplier;

    private Category $category;

    protected function setUp(): void
    {
        parent::setUp();

        $this->category = Category::factory()->create(['name' => 'Emballage']);
        $this->supplier = SupplierProfile::factory()->visible()->create();
    }

    private function product(array $attributes = [], ?SupplierProfile $supplier = null): Product
    {
        return Product::factory()->published()->for($supplier ?? $this->supplier, 'supplier')
            ->create(['category_id' => $this->category->id, ...$attributes]);
    }

    public function test_mettre_en_avant_renseigne_la_date_de_fin(): void
    {
        $this->freezeSecond(); // la base ne garde pas les microsecondes
        $product = $this->product();
        Sanctum::actingAs($this->supplier->user);

        $this->postJson("/api/supplier/products/{$product->id}/feature", ['days' => 14])
            ->assertOk()
            ->assertJsonPath('product.is_featured', true)
            ->assertJsonPath('product.featured_until', now()->addDays(14)->toIso8601String());

        $this->assertTrue($product->fresh()->featured_until->equalTo(now()->addDays(14)));
    }

    public function test_duree_et_statut_controles(): void
    {
        Sanctum::actingAs($this->supplier->user);
        $published = $this->product();
        $draft = $this->product(['status' => ProductStatus::DRAFT]);

        $this->postJson("/api/supplier/products/{$published->id}/feature", ['days' => 3])
            ->assertUnprocessable()->assertJsonValidationErrors('days');
        $this->postJson("/api/supplier/products/{$published->id}/feature")
            ->assertUnprocessable()->assertJsonValidationErrors('days');
        $this->postJson("/api/supplier/products/{$draft->id}/feature", ['days' => 7])
            ->assertUnprocessable()->assertJsonValidationErrors('status');
    }

    public function test_seul_le_proprietaire_met_en_avant(): void
    {
        $other = SupplierProfile::factory()->visible()->create();
        $product = $this->product([], $other);
        Sanctum::actingAs($this->supplier->user);

        $this->postJson("/api/supplier/products/{$product->id}/feature", ['days' => 7])->assertForbidden();
        $this->deleteJson("/api/supplier/products/{$product->id}/feature")->assertForbidden();
        $this->assertNull($product->fresh()->featured_until);
    }

    public function test_arreter_la_mise_en_avant(): void
    {
        $product = $this->product(['featured_until' => now()->addDays(5)]);
        Sanctum::actingAs($this->supplier->user);

        $this->deleteJson("/api/supplier/products/{$product->id}/feature")
            ->assertOk()
            ->assertJsonPath('product.is_featured', false);

        $this->assertNull($product->fresh()->featured_until);
    }

    public function test_depublier_arrete_la_mise_en_avant(): void
    {
        $product = $this->product(['featured_until' => now()->addDays(5)]);
        Sanctum::actingAs($this->supplier->user);

        $this->patchJson("/api/supplier/products/{$product->id}/unpublish")->assertOk();

        $this->assertNull($product->fresh()->featured_until);
    }

    public function test_en_tete_du_catalogue_pendant_la_periode_puis_fin_automatique(): void
    {
        $featured = $this->product(['title' => 'Ancien produit', 'created_at' => now()->subMonth(), 'featured_until' => now()->addDays(7)]);
        $recent = $this->product(['title' => 'Produit récent', 'created_at' => now()]);

        $this->getJson('/api/products')
            ->assertOk()
            ->assertJsonPath('data.0.id', $featured->id)
            ->assertJsonPath('data.0.featured', true)
            ->assertJsonPath('data.1.featured', false);

        // Un tri choisi par le visiteur reste respecté.
        $featured->update(['price' => 99]);
        $recent->update(['price' => 1]);
        $this->getJson('/api/products?sort=price_asc')->assertJsonPath('data.0.id', $recent->id);

        // Échéance passée : plus de badge ni de priorité, sans aucune tâche planifiée.
        $this->travel(8)->days();
        $this->getJson('/api/products')
            ->assertJsonPath('data.0.id', $recent->id)
            ->assertJsonPath('data.1.featured', false);
    }

    public function test_apparait_sur_l_accueil_immediatement(): void
    {
        $this->product(['title' => 'Produit ordinaire']);
        $product = $this->product(['title' => 'Cartons en promotion']);
        Cache::flush();
        $this->getJson('/api/home')->assertOk(); // page d'accueil mise en cache

        Sanctum::actingAs($this->supplier->user);
        $this->postJson("/api/supplier/products/{$product->id}/feature", ['days' => 7])->assertOk();

        $this->getJson('/api/home')->assertJsonPath('featured_products.0.id', $product->id);
    }
}
