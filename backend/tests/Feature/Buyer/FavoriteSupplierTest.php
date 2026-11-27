<?php

namespace Tests\Feature\Buyer;

use App\Models\BuyerProfile;
use App\Models\Category;
use App\Models\Region;
use App\Models\SupplierProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Gérer ses fournisseurs favoris (SCRUM-39).
 */
class FavoriteSupplierTest extends TestCase
{
    use RefreshDatabase;

    private User $buyer;

    private SupplierProfile $supplier;

    protected function setUp(): void
    {
        parent::setUp();

        $this->buyer = User::factory()->buyer()->create();
        $this->buyer->buyerProfile()->create(['organization' => 'Projet Djerba']);

        $this->supplier = SupplierProfile::factory()->visible()->create([
            'company_name' => 'Atlas Emballages',
            'region_id' => Region::create(['name' => 'Sfax'])->id,
            'rating_avg' => 4.6,
        ]);
        $this->supplier->categories()->attach(Category::factory()->create(['name' => 'Emballage']));
    }

    private function buyerProfile(): BuyerProfile
    {
        return $this->buyer->buyerProfile;
    }

    public function test_un_invite_recoit_401(): void
    {
        $this->getJson('/api/favorites/suppliers')->assertUnauthorized();
        $this->postJson("/api/favorites/suppliers/{$this->supplier->id}")->assertUnauthorized();
    }

    public function test_un_fournisseur_ou_un_admin_recoit_403(): void
    {
        foreach ([User::factory()->supplier()->create(), User::factory()->admin()->create()] as $user) {
            Sanctum::actingAs($user);
            $this->getJson('/api/favorites/suppliers')->assertForbidden();
            $this->postJson("/api/favorites/suppliers/{$this->supplier->id}")->assertForbidden();
        }
        $this->assertDatabaseCount('favorites', 0);
    }

    public function test_ajout_puis_liste(): void
    {
        Sanctum::actingAs($this->buyer);

        $this->postJson("/api/favorites/suppliers/{$this->supplier->id}")
            ->assertOk()
            ->assertJsonPath('is_favorite', true);

        $this->getJson('/api/favorites/suppliers')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.id', $this->supplier->id)
            ->assertJsonPath('0.company_name', 'Atlas Emballages')
            ->assertJsonPath('0.region', 'Sfax')
            ->assertJsonPath('0.rating_avg', 4.6)
            ->assertJsonPath('0.categories', ['Emballage']);
    }

    public function test_un_doublon_est_ignore(): void
    {
        Sanctum::actingAs($this->buyer);

        $this->postJson("/api/favorites/suppliers/{$this->supplier->id}")->assertOk();
        $this->postJson("/api/favorites/suppliers/{$this->supplier->id}")->assertOk();

        $this->assertDatabaseCount('favorites', 1);
    }

    public function test_retrait_idempotent(): void
    {
        $this->buyerProfile()->favoriteSuppliers()->attach($this->supplier->id);
        Sanctum::actingAs($this->buyer);

        $this->deleteJson("/api/favorites/suppliers/{$this->supplier->id}")
            ->assertOk()
            ->assertJsonPath('is_favorite', false);
        $this->deleteJson("/api/favorites/suppliers/{$this->supplier->id}")->assertOk();

        $this->assertDatabaseCount('favorites', 0);
        $this->getJson('/api/favorites/suppliers')->assertJsonCount(0);
    }

    public function test_les_favoris_d_un_autre_porteur_ne_sont_pas_visibles(): void
    {
        $other = User::factory()->buyer()->create();
        $other->buyerProfile()->create(['organization' => 'Autre'])->favoriteSuppliers()->attach($this->supplier->id);
        Sanctum::actingAs($this->buyer);

        $this->getJson('/api/favorites/suppliers')->assertJsonCount(0);
    }

    public function test_un_fournisseur_invisible_ne_peut_pas_etre_ajoute(): void
    {
        $pending = SupplierProfile::factory()->pending()->create();
        Sanctum::actingAs($this->buyer);

        $this->postJson("/api/favorites/suppliers/{$pending->id}")->assertNotFound();
        $this->postJson('/api/favorites/suppliers/999999')->assertNotFound();
        $this->assertDatabaseCount('favorites', 0);
    }

    public function test_un_fournisseur_devenu_invisible_est_exclu_de_la_liste(): void
    {
        $suspended = SupplierProfile::factory()->visible()->create();
        $unpublished = SupplierProfile::factory()->visible()->create();
        $this->buyerProfile()->favoriteSuppliers()->attach([$this->supplier->id, $suspended->id, $unpublished->id]);

        $suspended->user->update(['status' => 'suspendu']);
        $unpublished->update(['is_published' => false]);
        Sanctum::actingAs($this->buyer);

        $this->getJson('/api/favorites/suppliers')
            ->assertJsonCount(1)
            ->assertJsonPath('0.id', $this->supplier->id);

        // Il peut tout de même être retiré.
        $this->deleteJson("/api/favorites/suppliers/{$suspended->id}")->assertOk();
    }

    public function test_aucune_donnee_privee_dans_la_liste(): void
    {
        $this->buyerProfile()->favoriteSuppliers()->attach($this->supplier->id);
        Sanctum::actingAs($this->buyer);

        $item = $this->getJson('/api/favorites/suppliers')->json('0');

        $this->assertEqualsCanonicalizing(
            ['id', 'company_name', 'logo_url', 'region', 'rating_avg', 'reviews_count', 'categories', 'favorited_at'],
            array_keys($item),
        );
    }
}
