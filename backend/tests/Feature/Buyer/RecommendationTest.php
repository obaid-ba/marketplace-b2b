<?php

namespace Tests\Feature\Buyer;

use App\Enums\OrderStatus;
use App\Enums\QuoteStatus;
use App\Enums\TenderStatus;
use App\Enums\ValidationStatus;
use App\Models\Category;
use App\Models\Product;
use App\Models\Quote;
use App\Models\SupplierProfile;
use App\Models\Tender;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Recommander des fournisseurs selon les achats passés (SCRUM-87).
 */
class RecommendationTest extends TestCase
{
    use RefreshDatabase;

    private User $buyer;

    private Category $emballage;

    private Category $cartons;

    private Category $informatique;

    protected function setUp(): void
    {
        parent::setUp();

        $this->emballage = Category::create(['name' => 'Emballage', 'position' => 1]);
        $this->cartons = Category::create(['name' => 'Cartonnage', 'parent_id' => $this->emballage->id, 'position' => 1]);
        $this->informatique = Category::create(['name' => 'Informatique', 'position' => 2]);

        $this->buyer = User::factory()->buyer()->create();
        $this->buyer->buyerProfile()->create(['organization' => 'Huilerie']);
    }

    private function supplier(string $name, Category $category, float $rating = 0, int $reviews = 0, array $attributes = []): SupplierProfile
    {
        $supplier = SupplierProfile::factory()->visible()->create(['company_name' => $name, 'rating_avg' => $rating, 'reviews_count' => $reviews, ...$attributes]);
        $supplier->categories()->attach($category->id);

        return $supplier;
    }

    private function buyFrom(SupplierProfile $supplier, Category $category): void
    {
        $product = Product::factory()->published()->for($supplier, 'supplier')->create(['category_id' => $category->id]);
        $orderId = DB::table('orders')->insertGetId([
            'buyer_id' => $this->buyer->buyerProfile->id, 'supplier_id' => $supplier->id, 'origin' => 'catalogue',
            'total' => 100, 'status' => OrderStatus::CLOSED->value, 'created_at' => now(), 'updated_at' => now(),
        ]);
        DB::table('order_items')->insert([
            'order_id' => $orderId, 'product_id' => $product->id, 'label' => 'x', 'quantity' => 1, 'unit_price' => 100,
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    private function recommendations()
    {
        return $this->actingAs($this->buyer, 'sanctum')->getJson('/api/buyer/recommendations')->assertOk();
    }

    public function test_recommande_selon_les_categories_achetees_avec_la_raison(): void
    {
        $usual = $this->supplier('Fournisseur habituel', $this->cartons);
        $this->buyFrom($usual, $this->cartons);
        $this->buyFrom($usual, $this->cartons);

        $djerba = $this->supplier('Djerba Pack', $this->emballage, 4.3, 21); // catégorie parente : même famille
        $atlas = $this->supplier('Atlas Emballages', $this->cartons, 4.6, 38);
        $this->supplier('TechNova', $this->informatique, 5.0, 50); // rien acheté en informatique

        $response = $this->recommendations()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $atlas->id)
            ->assertJsonPath('data.1.id', $djerba->id)
            ->assertJsonPath('data.0.reason', 'Vous achetez en « Cartonnage » · note 4,6 / 5 sur 38 avis');

        $this->assertNotContains($usual->id, array_column($response->json('data'), 'id')); // déjà fournisseur
    }

    public function test_les_devis_acceptes_comptent_comme_achats(): void
    {
        $supplier = $this->supplier('Ancien', $this->informatique);
        $tender = Tender::create([
            'buyer_id' => $this->buyer->buyerProfile->id, 'title' => 'PC', 'description' => 'Ordinateurs portables',
            'category_id' => $this->informatique->id, 'status' => TenderStatus::CLOSED,
        ]);
        Quote::create(['tender_id' => $tender->id, 'supplier_id' => $supplier->id, 'amount' => 900, 'delivery_days' => 3, 'status' => QuoteStatus::ACCEPTED]);
        $techNova = $this->supplier('TechNova', $this->informatique, 4.8, 10);

        $this->recommendations()->assertJsonPath('data.0.id', $techNova->id)->assertJsonPath('data.0.reason', 'Vous achetez en « Informatique » · note 4,8 / 5 sur 10 avis');
    }

    public function test_exclut_les_favoris_et_les_comptes_non_valides(): void
    {
        $usual = $this->supplier('Habituel', $this->cartons);
        $this->buyFrom($usual, $this->cartons);
        $favorite = $this->supplier('Favori', $this->cartons, 4.9, 5);
        DB::table('favorites')->insert(['buyer_id' => $this->buyer->buyerProfile->id, 'supplier_id' => $favorite->id, 'created_at' => now(), 'updated_at' => now()]);
        $this->supplier('En attente', $this->cartons, 5, 3, ['validation_status' => ValidationStatus::PENDING]);
        $newcomer = $this->supplier('Nouveau', $this->cartons);

        $this->recommendations()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $newcomer->id)
            ->assertJsonPath('data.0.reason', 'Vous achetez en « Cartonnage » · Nouveau sur la plateforme');
    }

    public function test_sans_achat_les_mieux_notes(): void
    {
        $this->supplier('Moyen', $this->cartons, 3.9, 4);
        $best = $this->supplier('Excellent', $this->informatique, 4.9, 12);
        $this->supplier('Sans avis', $this->cartons);

        $this->recommendations()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $best->id)
            ->assertJsonPath('data.0.reason', 'Parmi les fournisseurs les mieux notés (note 4,9 / 5 sur 12 avis)');
    }

    public function test_reserve_au_porteur(): void
    {
        $this->actingAs(User::factory()->supplier()->create(), 'sanctum')->getJson('/api/buyer/recommendations')->assertForbidden();
    }
}
