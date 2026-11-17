<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Product;
use App\Models\SupplierProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Arborescence publique des catégories (SCRUM-32) : GET /api/categories.
 */
class PublicCategoryTest extends TestCase
{
    use RefreshDatabase;

    private function visibleSupplier(): SupplierProfile
    {
        return SupplierProfile::factory()->validated()->create(['is_published' => true]);
    }

    public function test_accessible_sans_connexion_et_trie_par_position(): void
    {
        $b = Category::factory()->create(['name' => 'B', 'position' => 2]);
        $a = Category::factory()->create(['name' => 'A', 'position' => 1]);
        Category::factory()->childOf($a)->create(['name' => 'A2', 'position' => 2]);
        Category::factory()->childOf($a)->create(['name' => 'A1', 'position' => 1]);

        $this->getJson('/api/categories')
            ->assertOk()
            ->assertJsonCount(2)
            ->assertJsonPath('0.name', 'A')
            ->assertJsonPath('0.children.0.name', 'A1')
            ->assertJsonPath('0.children.1.name', 'A2')
            ->assertJsonPath('1.name', $b->name)
            ->assertJsonPath('1.children', [])
            ->assertJsonMissingPath('0.tenders_count');
    }

    public function test_ne_compte_que_les_produits_visibles_et_inclut_les_sous_categories(): void
    {
        $parent = Category::factory()->create(['position' => 1]);
        $child = Category::factory()->childOf($parent)->create(['position' => 1]);
        $visible = $this->visibleSupplier();

        // Visibles : 1 sur le parent, 2 sur la sous-catégorie.
        Product::factory()->published()->for($visible, 'supplier')->create(['category_id' => $parent->id]);
        Product::factory()->published()->count(2)->for($visible, 'supplier')->create(['category_id' => $child->id]);

        // Jamais comptés.
        Product::factory()->for($visible, 'supplier')->create(['category_id' => $child->id]); // brouillon
        Product::factory()->withdrawn()->for($visible, 'supplier')->create(['category_id' => $child->id]);
        $pending = SupplierProfile::factory()->pending()->create(['is_published' => true]);
        Product::factory()->published()->for($pending, 'supplier')->create(['category_id' => $child->id]);
        $unpublished = SupplierProfile::factory()->validated()->create(['is_published' => false]);
        Product::factory()->published()->for($unpublished, 'supplier')->create(['category_id' => $child->id]);
        $suspended = SupplierProfile::factory()->validated()->create([
            'is_published' => true,
            'user_id' => User::factory()->supplier()->suspended(),
        ]);
        Product::factory()->published()->for($suspended, 'supplier')->create(['category_id' => $child->id]);
        $deleted = $this->visibleSupplier();
        Product::factory()->published()->for($deleted, 'supplier')->create(['category_id' => $child->id]);
        $deleted->user->delete();

        $this->getJson('/api/categories')
            ->assertOk()
            ->assertJsonPath('0.products_count', 3)
            ->assertJsonPath('0.children.0.products_count', 2);
    }
}
