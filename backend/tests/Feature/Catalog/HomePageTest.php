<?php

namespace Tests\Feature\Catalog;

use App\Models\Category;
use App\Models\Product;
use App\Models\Region;
use App\Models\SupplierProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Page d'accueil (SCRUM-38) : GET /api/home.
 */
class HomePageTest extends TestCase
{
    use RefreshDatabase;

    private Category $category;

    protected function setUp(): void
    {
        parent::setUp();

        $this->category = Category::factory()->create(['name' => 'Emballage', 'position' => 1]);
    }

    private function supplier(array $attributes = [], ?string $region = null): SupplierProfile
    {
        return SupplierProfile::factory()->visible()->create([
            'region_id' => $region ? Region::firstOrCreate(['name' => $region])->id : null,
            ...$attributes,
        ]);
    }

    private function product(SupplierProfile $supplier, array $attributes = []): Product
    {
        return Product::factory()->published()->for($supplier, 'supplier')->create(['category_id' => $this->category->id, ...$attributes]);
    }

    public function test_accessible_sans_connexion_avec_la_structure_attendue(): void
    {
        $this->getJson('/api/home')
            ->assertOk()
            ->assertJsonStructure([
                'stats' => ['suppliers', 'products', 'regions'],
                'categories',
                'featured_products',
            ]);
    }

    public function test_les_compteurs_excluent_les_elements_non_visibles(): void
    {
        $sfax = $this->supplier([], 'Sfax');
        $tunis = $this->supplier([], 'Tunis');
        $tunis->coverageRegions()->attach([Region::firstOrCreate(['name' => 'Sousse'])->id, Region::firstOrCreate(['name' => 'Sfax'])->id]);
        $this->product($sfax);
        $this->product($tunis);
        $this->product($sfax, ['status' => 'brouillon']);

        // Jamais comptés.
        $pending = SupplierProfile::factory()->pending()->create(['is_published' => true, 'region_id' => Region::firstOrCreate(['name' => 'Gabès'])->id]);
        $this->product($pending);
        $suspended = $this->supplier(['user_id' => User::factory()->supplier()->suspended()], 'Gafsa');
        $this->product($suspended);

        $this->getJson('/api/home')
            ->assertJsonPath('stats.suppliers', 2)
            ->assertJsonPath('stats.products', 2)
            ->assertJsonPath('stats.regions', 3); // Sfax, Tunis, Sousse
    }

    public function test_huit_categories_principales_triees_avec_compteur(): void
    {
        foreach (range(2, 10) as $position) {
            Category::factory()->create(['name' => "Cat {$position}", 'position' => $position]);
        }
        $child = Category::factory()->childOf($this->category)->create();
        $supplier = $this->supplier();
        $this->product($supplier);
        $this->product($supplier, ['category_id' => $child->id]);

        $response = $this->getJson('/api/home')->assertJsonCount(8, 'categories');

        $this->assertSame('Emballage', $response->json('categories.0.name'));
        $this->assertSame(2, $response->json('categories.0.products_count'));
        $this->assertSame('Cat 8', $response->json('categories.7.name'));
        $this->assertArrayNotHasKey('children', $response->json('categories.0'));
    }

    public function test_produits_mis_en_avant_puis_completes_par_les_mieux_notes(): void
    {
        $best = $this->supplier(['rating_avg' => 4.9]);
        $average = $this->supplier(['rating_avg' => 3.5]);
        $featured = $this->product($average, ['title' => 'Mis en avant', 'featured_until' => now()->addWeek()]);
        $this->product($average, ['title' => 'Expiré', 'featured_until' => now()->subDay()]);
        $this->product($best, ['title' => 'Bien noté 1']);
        $this->product($best, ['title' => 'Bien noté 2']);
        $this->product($best, ['title' => 'Bien noté 3']);
        $this->product($best, ['title' => 'Bien noté 4', 'status' => 'brouillon']);

        $titles = collect($this->getJson('/api/home')->assertJsonCount(4, 'featured_products')->json('featured_products'))->pluck('title');

        $this->assertSame('Mis en avant', $titles->first());
        $this->assertEqualsCanonicalizing(['Mis en avant', 'Bien noté 1', 'Bien noté 2', 'Bien noté 3'], $titles->all());
        $this->assertSame($featured->id, $this->getJson('/api/home')->json('featured_products.0.id'));
    }

    public function test_reponse_en_cache_dix_minutes(): void
    {
        $supplier = $this->supplier();
        $this->product($supplier);
        $this->getJson('/api/home')->assertJsonPath('stats.products', 1);

        $this->product($supplier);
        $this->getJson('/api/home')->assertJsonPath('stats.products', 1);

        $this->travel(11)->minutes();
        $this->getJson('/api/home')->assertJsonPath('stats.products', 2);
    }
}
