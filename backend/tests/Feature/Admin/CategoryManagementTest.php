<?php

namespace Tests\Feature\Admin;

use App\Models\AuditLog;
use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Gestion des catégories et sous-catégories par l'administrateur (SCRUM-32).
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

    private function root(string $name, int $position): Category
    {
        return Category::factory()->create(['name' => $name, 'position' => $position]);
    }

    private function child(Category $parent, string $name, int $position): Category
    {
        return Category::factory()->childOf($parent)->create(['name' => $name, 'position' => $position]);
    }

    /** @return list<string> */
    private function namesInOrder(?int $parentId): array
    {
        return Category::query()->siblingsOf($parentId)->ordered()->pluck('name')->all();
    }

    private function createTender(Category $category): void
    {
        $buyerUser = User::factory()->buyer()->create();
        $buyerId = DB::table('buyer_profiles')->insertGetId([
            'user_id' => $buyerUser->id,
            'organization' => 'Projet test',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('tenders')->insert([
            'buyer_id' => $buyerId,
            'title' => 'Besoin de cartons',
            'description' => 'Cartons pour expédition',
            'category_id' => $category->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    // --- Contrôle d'accès ---

    public function test_un_invite_recoit_401(): void
    {
        $this->getJson('/api/admin/categories')->assertUnauthorized();
        $this->postJson('/api/admin/categories', ['name' => 'X'])->assertUnauthorized();
    }

    public function test_un_fournisseur_ou_un_porteur_recoit_403(): void
    {
        $category = $this->root('Emballage', 1);

        foreach ([User::factory()->supplier()->create(), User::factory()->buyer()->create()] as $user) {
            Sanctum::actingAs($user);

            $this->getJson('/api/admin/categories')->assertForbidden();
            $this->postJson('/api/admin/categories', ['name' => 'X'])->assertForbidden();
            $this->putJson("/api/admin/categories/{$category->id}", ['name' => 'Y'])->assertForbidden();
            $this->patchJson("/api/admin/categories/{$category->id}/move", ['direction' => 'up'])->assertForbidden();
            $this->deleteJson("/api/admin/categories/{$category->id}")->assertForbidden();
        }

        $this->assertDatabaseHas('categories', ['id' => $category->id, 'name' => 'Emballage']);
    }

    // --- Lecture ---

    public function test_l_arbre_admin_est_trie_et_compte_produits_et_demandes(): void
    {
        $logistique = $this->root('Logistique', 2);
        $emballage = $this->root('Emballage', 1);
        $palettes = $this->child($emballage, 'Palettes', 2);
        $cartons = $this->child($emballage, 'Cartons', 1);

        Product::factory()->count(2)->create(['category_id' => $cartons->id]); // brouillons comptés côté admin
        Product::factory()->published()->create(['category_id' => $emballage->id]);
        $this->createTender($palettes);

        Sanctum::actingAs($this->admin);

        $this->getJson('/api/admin/categories')
            ->assertOk()
            ->assertJsonPath('0.name', 'Emballage')
            ->assertJsonPath('0.products_count', 3)
            ->assertJsonPath('0.tenders_count', 1)
            ->assertJsonPath('0.children.0.name', 'Cartons')
            ->assertJsonPath('0.children.0.products_count', 2)
            ->assertJsonPath('0.children.1.name', 'Palettes')
            ->assertJsonPath('0.children.1.tenders_count', 1)
            ->assertJsonPath('1.name', $logistique->name)
            ->assertJsonPath('1.products_count', 0);
    }

    // --- Création ---

    public function test_creation_d_une_categorie_principale_a_la_fin_et_trace_audit(): void
    {
        $this->root('Emballage', 1);
        Sanctum::actingAs($this->admin);

        $response = $this->postJson('/api/admin/categories', ['name' => '  Agroalimentaire  '])
            ->assertCreated()
            ->assertJsonPath('category.name', 'Agroalimentaire')
            ->assertJsonPath('category.parent_id', null)
            ->assertJsonPath('category.position', 2);

        $this->assertDatabaseHas('audit_logs', [
            'admin_id' => $this->admin->id,
            'action' => 'category.created',
            'target' => 'category:'.$response->json('category.id'),
        ]);
    }

    public function test_creation_d_une_sous_categorie_a_une_position_donnee_decale_les_autres(): void
    {
        $emballage = $this->root('Emballage', 1);
        $this->child($emballage, 'Cartons', 1);
        $this->child($emballage, 'Films', 2);
        Sanctum::actingAs($this->admin);

        $this->postJson('/api/admin/categories', ['name' => 'Palettes', 'parent_id' => $emballage->id, 'position' => 1])
            ->assertCreated()
            ->assertJsonPath('category.parent_id', $emballage->id)
            ->assertJsonPath('category.position', 1);

        $this->assertSame(['Palettes', 'Cartons', 'Films'], $this->namesInOrder($emballage->id));
    }

    public function test_creation_refusee_sans_nom_ou_avec_un_parent_inconnu(): void
    {
        Sanctum::actingAs($this->admin);

        $this->postJson('/api/admin/categories', ['name' => ''])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name' => 'Le nom de la catégorie est obligatoire.']);

        $this->postJson('/api/admin/categories', ['name' => 'X', 'parent_id' => 999])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['parent_id' => 'La catégorie parente est introuvable.']);
    }

    public function test_profondeur_limitee_a_deux_niveaux(): void
    {
        $emballage = $this->root('Emballage', 1);
        $cartons = $this->child($emballage, 'Cartons', 1);
        Sanctum::actingAs($this->admin);

        $this->postJson('/api/admin/categories', ['name' => 'Petits cartons', 'parent_id' => $cartons->id])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('parent_id');

        $this->assertDatabaseMissing('categories', ['name' => 'Petits cartons']);
    }

    public function test_nom_unique_sous_un_meme_parent_insensible_a_la_casse(): void
    {
        $emballage = $this->root('Emballage', 1);
        $logistique = $this->root('Logistique', 2);
        $this->child($emballage, 'Palettes', 1);
        Sanctum::actingAs($this->admin);

        $this->postJson('/api/admin/categories', ['name' => 'palettes', 'parent_id' => $emballage->id])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name' => 'Une sous-catégorie de ce parent porte déjà ce nom.']);

        $this->postJson('/api/admin/categories', ['name' => 'EMBALLAGE'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name' => 'Une catégorie principale porte déjà ce nom.']);

        // Même nom sous un autre parent : autorisé.
        $this->postJson('/api/admin/categories', ['name' => 'Palettes', 'parent_id' => $logistique->id])
            ->assertCreated();
    }

    // --- Modification ---

    public function test_renommage_et_trace_audit(): void
    {
        $category = $this->root('Emballage', 1);
        Sanctum::actingAs($this->admin);

        $this->putJson("/api/admin/categories/{$category->id}", ['name' => 'Emballage et conditionnement'])
            ->assertOk()
            ->assertJsonPath('category.name', 'Emballage et conditionnement');

        $log = AuditLog::query()->where('action', 'category.updated')->sole();
        $this->assertSame("category:{$category->id}", $log->target);
        $this->assertStringContainsString('renommée en « Emballage et conditionnement »', $log->reason);
    }

    public function test_garder_son_propre_nom_n_est_pas_un_doublon(): void
    {
        $category = $this->root('Emballage', 1);
        Sanctum::actingAs($this->admin);

        $this->putJson("/api/admin/categories/{$category->id}", ['name' => 'Emballage', 'position' => 1])->assertOk();
    }

    public function test_une_categorie_ne_peut_pas_etre_sa_propre_parente(): void
    {
        $category = $this->root('Emballage', 1);
        Sanctum::actingAs($this->admin);

        $this->putJson("/api/admin/categories/{$category->id}", ['parent_id' => $category->id])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['parent_id' => 'Une catégorie ne peut pas être sa propre catégorie parente.']);
    }

    public function test_une_categorie_avec_sous_categories_ne_peut_pas_devenir_sous_categorie(): void
    {
        $emballage = $this->root('Emballage', 1);
        $logistique = $this->root('Logistique', 2);
        $this->child($emballage, 'Cartons', 1);
        Sanctum::actingAs($this->admin);

        $this->putJson("/api/admin/categories/{$emballage->id}", ['parent_id' => $logistique->id])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('parent_id');

        $this->assertNull($emballage->fresh()->parent_id);
    }

    public function test_changer_de_parent_renumerote_l_ancien_et_le_nouveau_groupe(): void
    {
        $emballage = $this->root('Emballage', 1);
        $logistique = $this->root('Logistique', 2);
        $cartons = $this->child($emballage, 'Cartons', 1);
        $this->child($emballage, 'Films', 2);
        $this->child($logistique, 'Transport', 1);
        Sanctum::actingAs($this->admin);

        $this->putJson("/api/admin/categories/{$cartons->id}", ['parent_id' => $logistique->id])
            ->assertOk()
            ->assertJsonPath('category.parent_id', $logistique->id)
            ->assertJsonPath('category.position', 2);

        $this->assertSame(['Films'], $this->namesInOrder($emballage->id));
        $this->assertSame(1, Category::query()->where('name', 'Films')->value('position'));
        $this->assertSame(['Transport', 'Cartons'], $this->namesInOrder($logistique->id));
    }

    public function test_une_sous_categorie_peut_redevenir_categorie_principale(): void
    {
        $emballage = $this->root('Emballage', 1);
        $cartons = $this->child($emballage, 'Cartons', 1);
        Sanctum::actingAs($this->admin);

        $this->putJson("/api/admin/categories/{$cartons->id}", ['parent_id' => null, 'position' => 1])
            ->assertOk()
            ->assertJsonPath('category.parent_id', null);

        $this->assertSame(['Cartons', 'Emballage'], $this->namesInOrder(null));
    }

    // --- Réordonnancement ---

    public function test_monter_et_descendre_une_categorie(): void
    {
        $this->root('A', 1);
        $b = $this->root('B', 2);
        $this->root('C', 3);
        Sanctum::actingAs($this->admin);

        $this->patchJson("/api/admin/categories/{$b->id}/move", ['direction' => 'up'])
            ->assertOk()
            ->assertJsonPath('category.position', 1);
        $this->assertSame(['B', 'A', 'C'], $this->namesInOrder(null));

        $this->patchJson("/api/admin/categories/{$b->id}/move", ['direction' => 'down'])->assertOk();
        $this->patchJson("/api/admin/categories/{$b->id}/move", ['direction' => 'down'])->assertOk();
        $this->assertSame(['A', 'C', 'B'], $this->namesInOrder(null));

        $this->assertSame(3, AuditLog::query()->where('action', 'category.moved')->count());
    }

    public function test_monter_le_premier_ou_descendre_le_dernier_ne_change_rien(): void
    {
        $a = $this->root('A', 1);
        $b = $this->root('B', 2);
        Sanctum::actingAs($this->admin);

        $this->patchJson("/api/admin/categories/{$a->id}/move", ['direction' => 'up'])->assertOk();
        $this->patchJson("/api/admin/categories/{$b->id}/move", ['direction' => 'down'])->assertOk();

        $this->assertSame(['A', 'B'], $this->namesInOrder(null));
    }

    public function test_deplacer_a_une_position_precise_dans_son_groupe_uniquement(): void
    {
        $emballage = $this->root('Emballage', 1);
        $this->root('Logistique', 2);
        $this->child($emballage, 'Cartons', 1);
        $this->child($emballage, 'Films', 2);
        $palettes = $this->child($emballage, 'Palettes', 3);
        Sanctum::actingAs($this->admin);

        $this->patchJson("/api/admin/categories/{$palettes->id}/move", ['position' => 1])->assertOk();

        $this->assertSame(['Palettes', 'Cartons', 'Films'], $this->namesInOrder($emballage->id));
        $this->assertSame(['Emballage', 'Logistique'], $this->namesInOrder(null));
    }

    public function test_les_positions_existantes_avec_trous_sont_renumerotees(): void
    {
        $this->root('A', 5);
        $b = $this->root('B', 10);
        Sanctum::actingAs($this->admin);

        $this->patchJson("/api/admin/categories/{$b->id}/move", ['direction' => 'up'])->assertOk();

        $this->assertSame(['B', 'A'], $this->namesInOrder(null));
        $this->assertSame([1, 2], Category::query()->ordered()->pluck('position')->all());
    }

    public function test_deplacement_invalide_renvoie_422(): void
    {
        $a = $this->root('A', 1);
        Sanctum::actingAs($this->admin);

        $this->patchJson("/api/admin/categories/{$a->id}/move", [])->assertUnprocessable();
        $this->patchJson("/api/admin/categories/{$a->id}/move", ['direction' => 'left'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('direction');
        $this->patchJson("/api/admin/categories/{$a->id}/move", ['position' => 0])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('position');
    }

    // --- Suppression ---

    public function test_suppression_d_une_categorie_inutilisee_renumerote_et_trace(): void
    {
        $a = $this->root('A', 1);
        $this->root('B', 2);
        Sanctum::actingAs($this->admin);

        $this->deleteJson("/api/admin/categories/{$a->id}")
            ->assertOk()
            ->assertJsonPath('message', 'La catégorie « A » a été supprimée.');

        $this->assertModelMissing($a);
        $this->assertSame(1, Category::query()->where('name', 'B')->value('position'));
        $this->assertDatabaseHas('audit_logs', ['action' => 'category.deleted', 'target' => "category:{$a->id}"]);
    }

    public function test_suppression_refusee_si_des_produits_l_utilisent(): void
    {
        $category = $this->root('Emballage', 1);
        Product::factory()->count(2)->create(['category_id' => $category->id]);
        Sanctum::actingAs($this->admin);

        $this->deleteJson("/api/admin/categories/{$category->id}")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['category' => 'utilisée par 2 produits']);

        $this->assertModelExists($category);
        $this->assertSame(0, AuditLog::query()->count());
    }

    public function test_suppression_refusee_si_une_demande_l_utilise(): void
    {
        $category = $this->root('Emballage', 1);
        $this->createTender($category);
        Sanctum::actingAs($this->admin);

        $this->deleteJson("/api/admin/categories/{$category->id}")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['category' => 'utilisée par 1 demande']);

        $this->assertModelExists($category);
    }

    public function test_suppression_refusee_si_la_categorie_a_des_sous_categories(): void
    {
        $emballage = $this->root('Emballage', 1);
        $cartons = $this->child($emballage, 'Cartons', 1);
        Sanctum::actingAs($this->admin);

        $this->deleteJson("/api/admin/categories/{$emballage->id}")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['category' => 'elle contient 1 sous-catégorie']);

        $this->assertModelExists($emballage);
        $this->assertModelExists($cartons);
    }

    public function test_categorie_inconnue_renvoie_404(): void
    {
        Sanctum::actingAs($this->admin);

        $this->putJson('/api/admin/categories/999', ['name' => 'X'])->assertNotFound();
        $this->deleteJson('/api/admin/categories/999')->assertNotFound();
    }
}
