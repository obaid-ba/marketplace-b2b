<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\BuyerProfile;
use App\Models\Category;
use App\Models\SupplierProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Tests de gestion des catégories et sous-catégories (SCRUM-32 / F06).
 */
class CategoryManagementTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->admin()->create();
    }

    private function actingAsAdmin(): void
    {
        Sanctum::actingAs($this->admin);
    }

    // --- 1. Contrôle d'accès (401 / 403) ---

    public function test_un_invite_ne_peut_pas_acceder_aux_categories_admin(): void
    {
        $this->getJson('/api/admin/categories')->assertUnauthorized();
        $this->postJson('/api/admin/categories', ['name' => 'Test'])->assertUnauthorized();
    }

    public function test_un_fournisseur_ou_un_porteur_ne_peut_pas_gerer_les_categories(): void
    {
        $supplier = User::factory()->supplier()->create();
        Sanctum::actingAs($supplier);
        $this->getJson('/api/admin/categories')->assertForbidden();
        $this->postJson('/api/admin/categories', ['name' => 'Test'])->assertForbidden();

        $buyer = User::factory()->buyer()->create();
        Sanctum::actingAs($buyer);
        $this->getJson('/api/admin/categories')->assertForbidden();
    }

    // --- 2. Récupération de l'arborescence triée par position ---

    public function test_recuperation_de_l_arborescence_categories_et_sous_categories_triee(): void
    {
        $this->actingAsAdmin();

        $cat2 = Category::create(['name' => 'BTP & Construction', 'position' => 2]);
        $cat1 = Category::create(['name' => 'Agroalimentaire', 'position' => 1]);

        $sub2 = Category::create(['name' => 'Plomberie', 'parent_id' => $cat2->id, 'position' => 2]);
        $sub1 = Category::create(['name' => 'Gros œuvre', 'parent_id' => $cat2->id, 'position' => 1]);

        $response = $this->getJson('/api/admin/categories')
            ->assertOk()
            ->assertJsonCount(2);

        $data = $response->json();
        // Vérifie l'ordre des catégories principales
        $this->assertSame($cat1->id, $data[0]['id']);
        $this->assertSame($cat2->id, $data[1]['id']);

        // Vérifie les sous-catégories de BTP et leur ordre
        $this->assertCount(2, $data[1]['children']);
        $this->assertSame($sub1->id, $data[1]['children'][0]['id']);
        $this->assertSame($sub2->id, $data[1]['children'][1]['id']);

        // Vérifie la présence des compteurs
        $this->assertArrayHasKey('products_count', $data[0]);
        $this->assertArrayHasKey('tenders_count', $data[0]);
    }

    // --- 3. Création catégorie principale et sous-catégorie + AuditLog ---

    public function test_creation_d_une_categorie_principale_et_trace_audit_log(): void
    {
        $this->actingAsAdmin();

        $response = $this->postJson('/api/admin/categories', [
            'name' => 'Informatique & Télécoms',
        ])
            ->assertCreated()
            ->assertJsonPath('category.name', 'Informatique & Télécoms')
            ->assertJsonPath('category.parent_id', null)
            ->assertJsonPath('category.position', 1);

        $categoryId = $response->json('category.id');

        $this->assertDatabaseHas('categories', [
            'id' => $categoryId,
            'name' => 'Informatique & Télécoms',
            'parent_id' => null,
            'position' => 1,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'admin_id' => $this->admin->id,
            'action' => 'category.created',
            'target' => "category:{$categoryId}",
        ]);
    }

    public function test_creation_d_une_sous_categorie_avec_parent_id(): void
    {
        $this->actingAsAdmin();

        $parent = Category::create(['name' => 'Informatique', 'position' => 1]);

        $response = $this->postJson('/api/admin/categories', [
            'name' => 'Serveurs & Réseaux',
            'parent_id' => $parent->id,
            'position' => 5,
        ])
            ->assertCreated()
            ->assertJsonPath('category.name', 'Serveurs & Réseaux')
            ->assertJsonPath('category.parent_id', $parent->id)
            ->assertJsonPath('category.position', 5);

        $this->assertDatabaseHas('categories', [
            'name' => 'Serveurs & Réseaux',
            'parent_id' => $parent->id,
            'position' => 5,
        ]);
    }

    // --- 4. Renommage et modification + AuditLog ---

    public function test_renommage_d_une_categorie_et_trace_audit_log(): void
    {
        $this->actingAsAdmin();

        $category = Category::create(['name' => 'Ancien Nom', 'position' => 1]);

        $this->putJson("/api/admin/categories/{$category->id}", [
            'name' => 'Nouveau Nom',
        ])
            ->assertOk()
            ->assertJsonPath('category.name', 'Nouveau Nom');

        $this->assertSame('Nouveau Nom', $category->fresh()->name);

        $this->assertDatabaseHas('audit_logs', [
            'admin_id' => $this->admin->id,
            'action' => 'category.updated',
            'target' => "category:{$category->id}",
        ]);
    }

    // --- 5. Réordonnancement via PATCH reorder + AuditLog ---

    public function test_reordonnancement_via_patch_reorder(): void
    {
        $this->actingAsAdmin();

        $catA = Category::create(['name' => 'Catégorie A', 'position' => 1]);
        $catB = Category::create(['name' => 'Catégorie B', 'position' => 2]);

        $this->patchJson('/api/admin/categories/reorder', [
            'items' => [
                ['id' => $catA->id, 'position' => 2],
                ['id' => $catB->id, 'position' => 1],
            ],
        ])->assertOk();

        $this->assertSame(2, $catA->fresh()->position);
        $this->assertSame(1, $catB->fresh()->position);

        $this->assertDatabaseHas('audit_logs', [
            'admin_id' => $this->admin->id,
            'action' => 'category.reordered',
            'target' => 'categories',
        ]);
    }

    // --- 6. Blocage de la suppression si produit rattaché (422) ---

    public function test_blocage_suppression_si_produit_utilise_la_categorie(): void
    {
        $this->actingAsAdmin();

        $supplier = SupplierProfile::factory()->create();
        $parent = Category::create(['name' => 'Matières premières', 'position' => 1]);
        $sub = Category::create(['name' => 'Céréales', 'parent_id' => $parent->id, 'position' => 1]);

        // Produit rattaché à la sous-catégorie
        DB::table('products')->insert([
            'supplier_id' => $supplier->id,
            'category_id' => $sub->id,
            'type' => 'produit',
            'title' => 'Blé dur en gros',
            'price' => 150.00,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Tentative de supprimer la sous-catégorie
        $this->deleteJson("/api/admin/categories/{$sub->id}")
            ->assertStatus(422)
            ->assertJsonPath('reason', 'category_in_use')
            ->assertJsonPath('products_count', 1);

        // Tentative de supprimer la catégorie parente (qui contient la sous-catégorie utilisée)
        $this->deleteJson("/api/admin/categories/{$parent->id}")
            ->assertStatus(422)
            ->assertJsonPath('reason', 'category_in_use')
            ->assertJsonPath('products_count', 1);

        $this->assertDatabaseHas('categories', ['id' => $parent->id]);
        $this->assertDatabaseHas('categories', ['id' => $sub->id]);
    }

    // --- 7. Blocage de la suppression si demande (tender) rattachée (422) ---

    public function test_blocage_suppression_si_demande_utilise_la_categorie(): void
    {
        $this->actingAsAdmin();

        $buyerUser = User::factory()->buyer()->create();
        $buyer = $buyerUser->buyerProfile()->create(['organization' => 'Entreprise Acheteuse']);
        $category = Category::create(['name' => 'Transport & Logistique', 'position' => 1]);

        DB::table('tenders')->insert([
            'buyer_id' => $buyer->id,
            'title' => 'Besoin de fret maritime',
            'description' => 'Recherche transporteur',
            'category_id' => $category->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->deleteJson("/api/admin/categories/{$category->id}")
            ->assertStatus(422)
            ->assertJsonPath('reason', 'category_in_use')
            ->assertJsonPath('tenders_count', 1);

        $this->assertDatabaseHas('categories', ['id' => $category->id]);
    }

    // --- 8. Suppression réussie si non utilisée (200) + AuditLog ---

    public function test_suppression_reussie_d_une_categorie_non_utilisee(): void
    {
        $this->actingAsAdmin();

        $category = Category::create(['name' => 'Catégorie Vide', 'position' => 1]);

        $this->deleteJson("/api/admin/categories/{$category->id}")
            ->assertOk()
            ->assertJsonPath('message', 'La catégorie « Catégorie Vide » a été supprimée avec succès.');

        $this->assertDatabaseMissing('categories', ['id' => $category->id]);

        $this->assertDatabaseHas('audit_logs', [
            'admin_id' => $this->admin->id,
            'action' => 'category.deleted',
            'target' => "category:{$category->id}",
        ]);
    }
}
