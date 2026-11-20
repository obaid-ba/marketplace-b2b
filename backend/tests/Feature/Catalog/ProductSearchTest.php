<?php

namespace Tests\Feature\Catalog;

use App\Models\Category;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\Region;
use App\Models\SupplierProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Catalogue public : recherche et filtres (SCRUM-35) — GET /api/products.
 */
class ProductSearchTest extends TestCase
{
    use RefreshDatabase;

    private SupplierProfile $supplier;

    private Category $category;

    protected function setUp(): void
    {
        parent::setUp();

        $this->category = Category::factory()->create(['position' => 1]);
        $this->supplier = SupplierProfile::factory()->visible()->create([
            'company_name' => 'Atlas Emballages',
            'region_id' => Region::create(['name' => 'Sfax'])->id,
            'rating_avg' => 4.6,
        ]);
    }

    private function product(array $attributes = [], ?SupplierProfile $supplier = null): Product
    {
        return Product::factory()->published()->for($supplier ?? $this->supplier, 'supplier')->create([
            'category_id' => $this->category->id,
            ...$attributes,
        ]);
    }

    /** @return list<string> */
    private function titles(string $query = ''): array
    {
        return collect($this->getJson('/api/products'.$query)->assertOk()->json('data'))->pluck('title')->all();
    }

    public function test_accessible_sans_connexion_avec_le_format_de_carte(): void
    {
        $product = $this->product(['title' => 'Cartons ondulés', 'price' => 2.4, 'unit' => 'pièce']);
        ProductImage::create(['product_id' => $product->id, 'path' => 'products/2.jpg', 'position' => 2]);
        ProductImage::create(['product_id' => $product->id, 'path' => 'products/1.jpg', 'position' => 1]);

        $this->getJson('/api/products')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('meta.per_page', 12)
            ->assertJsonPath('data.0.id', $product->id)
            ->assertJsonPath('data.0.title', 'Cartons ondulés')
            ->assertJsonPath('data.0.type', 'product')
            ->assertJsonPath('data.0.price', 2.4)
            ->assertJsonPath('data.0.unit', 'pièce')
            ->assertJsonPath('data.0.supplier.company_name', 'Atlas Emballages')
            ->assertJsonPath('data.0.supplier.region', 'Sfax')
            ->assertJsonPath('data.0.supplier.rating_avg', 4.6)
            ->assertJson(fn ($json) => $json->where('data.0.main_image_url', fn ($url) => str_ends_with($url, 'products/1.jpg'))->etc());
    }

    public function test_seuls_les_produits_visibles_sont_listes(): void
    {
        $this->product(['title' => 'Visible']);
        $this->product(['title' => 'Brouillon', 'status' => 'brouillon']);
        Product::factory()->withdrawn()->for($this->supplier, 'supplier')->create(['title' => 'Retiré']);

        $this->product(['title' => 'Fournisseur en attente'], SupplierProfile::factory()->pending()->create(['is_published' => true]));
        $this->product(['title' => 'Fournisseur refusé'], SupplierProfile::factory()->rejected()->create());
        $this->product(['title' => 'Profil non publié'], SupplierProfile::factory()->validated()->create(['is_published' => false]));
        $this->product(['title' => 'Fournisseur suspendu'], SupplierProfile::factory()->visible()->create([
            'user_id' => User::factory()->supplier()->suspended(),
        ]));
        $this->product(['title' => 'Fournisseur désactivé'], SupplierProfile::factory()->visible()->create([
            'user_id' => User::factory()->supplier()->deactivated(),
        ]));
        $deleted = SupplierProfile::factory()->visible()->create();
        $this->product(['title' => 'Fournisseur supprimé'], $deleted);
        $deleted->user->delete();

        $this->assertSame(['Visible'], $this->titles());
    }

    public function test_recherche_par_mots_cles_dans_le_titre_et_la_description(): void
    {
        $this->product(['title' => 'Palettes bois', 'description' => 'Pour cartons lourds']);
        $this->product(['title' => 'Cartons ondulés', 'description' => 'Double cannelure']);
        $this->product(['title' => 'Film étirable', 'description' => 'Rouleau 500 mm']);

        // Pertinence : un résultat dont le titre contient le mot passe avant une simple mention dans la description.
        $this->assertSame(['Cartons ondulés', 'Palettes bois'], $this->titles('?q=carton'));
        $this->assertSame([], $this->titles('?q=inexistant'));
    }

    public function test_les_caracteres_speciaux_de_like_sont_echappes(): void
    {
        $this->product(['title' => 'Remise 100% garantie']);
        $this->product(['title' => 'Produit standard']);

        $this->assertSame(['Remise 100% garantie'], $this->titles('?q='.urlencode('100%')));
        $this->assertSame([], $this->titles('?q=_'));
    }

    public function test_filtre_categorie_inclut_les_sous_categories(): void
    {
        $child = Category::factory()->childOf($this->category)->create();
        $other = Category::factory()->create();
        $this->product(['title' => 'Parent']);
        $this->product(['title' => 'Enfant', 'category_id' => $child->id]);
        $this->product(['title' => 'Autre', 'category_id' => $other->id]);

        $this->assertEqualsCanonicalizing(['Parent', 'Enfant'], $this->titles("?category={$this->category->id}"));
        $this->assertSame(['Enfant'], $this->titles("?category={$child->id}"));
        $this->assertEqualsCanonicalizing(['Enfant', 'Autre'], $this->titles("?category={$child->id},{$other->id}"));
    }

    public function test_filtre_type(): void
    {
        $this->product(['title' => 'Carton']);
        Product::factory()->published()->service()->for($this->supplier, 'supplier')
            ->create(['title' => 'Maintenance', 'category_id' => $this->category->id]);

        $this->assertSame(['Carton'], $this->titles('?type=product'));
        $this->assertSame(['Maintenance'], $this->titles('?type=service'));
        $this->assertCount(2, $this->titles('?type=product,service'));
    }

    public function test_filtre_region_du_fournisseur(): void
    {
        $tunis = Region::create(['name' => 'Tunis']);
        $this->product(['title' => 'Sfax']);
        $this->product(['title' => 'Tunis'], SupplierProfile::factory()->visible()->create(['region_id' => $tunis->id]));

        $this->assertSame(['Tunis'], $this->titles("?region={$tunis->id}"));
    }

    public function test_filtre_fourchette_de_prix(): void
    {
        $this->product(['title' => 'A', 'price' => 5]);
        $this->product(['title' => 'B', 'price' => 50]);
        $this->product(['title' => 'C', 'price' => 500]);

        $this->assertSame(['B'], $this->titles('?price_min=10&price_max=100'));
        $this->assertEqualsCanonicalizing(['B', 'C'], $this->titles('?price_min=50'));
        $this->assertEqualsCanonicalizing(['A', 'B'], $this->titles('?price_max=50'));
    }

    public function test_filtre_delai_de_disponibilite(): void
    {
        $this->product(['title' => '48h', 'availability_days' => 2]);
        $this->product(['title' => '7j', 'availability_days' => 7]);
        $this->product(['title' => '30j', 'availability_days' => 30]);
        $this->product(['title' => 'Inconnu', 'availability_days' => null]);

        $this->assertSame(['48h'], $this->titles('?delay=2'));
        $this->assertEqualsCanonicalizing(['48h', '7j'], $this->titles('?delay=7'));
    }

    public function test_filtre_note_du_fournisseur(): void
    {
        $this->product(['title' => 'Bien noté']);
        $this->product(['title' => 'Moyen'], SupplierProfile::factory()->visible()->create(['rating_avg' => 3.4]));
        $this->product(['title' => 'Mal noté'], SupplierProfile::factory()->visible()->create(['rating_avg' => 2]));

        $this->assertSame(['Bien noté'], $this->titles('?rating=4'));
        $this->assertEqualsCanonicalizing(['Bien noté', 'Moyen'], $this->titles('?rating=3'));
    }

    public function test_filtres_combines(): void
    {
        $tunis = Region::create(['name' => 'Tunis']);
        $tunisSupplier = SupplierProfile::factory()->visible()->create(['region_id' => $tunis->id, 'rating_avg' => 4.8]);
        $this->product(['title' => 'Carton Tunis pas cher', 'price' => 3, 'availability_days' => 2], $tunisSupplier);
        $this->product(['title' => 'Carton Tunis cher', 'price' => 300, 'availability_days' => 2], $tunisSupplier);
        $this->product(['title' => 'Carton Sfax', 'price' => 3, 'availability_days' => 2]);
        $this->product(['title' => 'Carton Tunis lent', 'price' => 3, 'availability_days' => 30], $tunisSupplier);

        $this->assertSame(
            ['Carton Tunis pas cher'],
            $this->titles("?q=carton&category={$this->category->id}&type=product&region={$tunis->id}&price_max=10&delay=7&rating=4"),
        );
    }

    public function test_filtres_supplier_id_et_exclude(): void
    {
        $other = SupplierProfile::factory()->visible()->create();
        $a = $this->product(['title' => 'A']);
        $this->product(['title' => 'B']);
        $this->product(['title' => 'C'], $other);

        $this->assertEqualsCanonicalizing(['A', 'B'], $this->titles("?supplier_id={$this->supplier->id}"));
        $this->assertEqualsCanonicalizing(['B', 'C'], $this->titles("?exclude={$a->id}"));
    }

    public function test_tris(): void
    {
        $best = SupplierProfile::factory()->visible()->create(['rating_avg' => 4.9]);
        $worst = SupplierProfile::factory()->visible()->create(['rating_avg' => 3.1]);
        $this->product(['title' => 'Ancien', 'price' => 20, 'created_at' => now()->subDays(3)]);
        $this->product(['title' => 'Récent', 'price' => 5, 'created_at' => now()->subDay()], $worst);
        $this->product(['title' => 'Nouveau', 'price' => 100, 'created_at' => now()], $best);

        $this->assertSame(['Récent', 'Ancien', 'Nouveau'], $this->titles('?sort=price_asc'));
        $this->assertSame(['Nouveau', 'Ancien', 'Récent'], $this->titles('?sort=price_desc'));
        $this->assertSame(['Nouveau', 'Ancien', 'Récent'], $this->titles('?sort=rating'));
        $this->assertSame(['Nouveau', 'Récent', 'Ancien'], $this->titles('?sort=newest'));
        // Sans mots-clés, le tri par défaut est « Nouveautés ».
        $this->assertSame(['Nouveau', 'Récent', 'Ancien'], $this->titles());
    }

    public function test_pagination(): void
    {
        Product::factory()->published()->count(15)->for($this->supplier, 'supplier')->create(['category_id' => $this->category->id]);

        $this->getJson('/api/products?page=2')
            ->assertOk()
            ->assertJsonCount(3, 'data')
            ->assertJsonPath('meta.current_page', 2)
            ->assertJsonPath('meta.last_page', 2)
            ->assertJsonPath('meta.total', 15);

        $this->getJson('/api/products?per_page=4')->assertJsonCount(4, 'data')->assertJsonPath('meta.last_page', 4);
    }

    public function test_parametres_invalides_renvoient_422(): void
    {
        $this->getJson('/api/products?sort=au_hasard')->assertUnprocessable()->assertJsonValidationErrors('sort');
        $this->getJson('/api/products?price_min=100&price_max=10')->assertUnprocessable()->assertJsonValidationErrors('price_max');
        $this->getJson('/api/products?price_min=-1')->assertUnprocessable()->assertJsonValidationErrors('price_min');
        $this->getJson('/api/products?rating=6')->assertUnprocessable()->assertJsonValidationErrors('rating');
        $this->getJson('/api/products?type=machine')->assertUnprocessable()->assertJsonValidationErrors('type.0');
        $this->getJson('/api/products?category=abc')->assertUnprocessable()->assertJsonValidationErrors('category.0');
        $this->getJson('/api/products?per_page=100')->assertUnprocessable()->assertJsonValidationErrors('per_page');
        $this->getJson('/api/products?delay=0')->assertUnprocessable()->assertJsonValidationErrors('delay');
    }

    public function test_nombre_de_requetes_constant_quel_que_soit_le_nombre_de_resultats(): void
    {
        $countQueries = function (): int {
            DB::flushQueryLog();
            DB::enableQueryLog();
            $this->getJson('/api/products')->assertOk();
            $count = count(DB::getQueryLog());
            DB::disableQueryLog();

            return $count;
        };

        $product = $this->product();
        ProductImage::create(['product_id' => $product->id, 'path' => 'a.jpg', 'position' => 1]);
        $withOne = $countQueries();

        foreach (range(1, 10) as $i) {
            $supplier = SupplierProfile::factory()->visible()->create(['region_id' => Region::create(['name' => "R{$i}"])->id]);
            $p = $this->product([], $supplier);
            ProductImage::create(['product_id' => $p->id, 'path' => "{$i}.jpg", 'position' => 1]);
        }

        $this->assertSame($withOne, $countQueries());
    }
}
