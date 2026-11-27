<?php

namespace Tests\Feature\Catalog;

use App\Enums\ValidationStatus;
use App\Models\Category;
use App\Models\Product;
use App\Models\Region;
use App\Models\SupplierProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Annuaire public des fournisseurs (lien « Fournisseurs » du site public).
 */
class SupplierDirectoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_liste_les_fournisseurs_visibles_avec_filtres_et_tri(): void
    {
        $sfax = Region::create(['name' => 'Sfax']);
        $tunis = Region::create(['name' => 'Tunis']);
        $emballage = Category::create(['name' => 'Emballage', 'position' => 1]);
        $cartons = Category::create(['name' => 'Cartonnage', 'parent_id' => $emballage->id, 'position' => 1]);
        $informatique = Category::create(['name' => 'Informatique', 'position' => 2]);

        $atlas = SupplierProfile::factory()->visible()->create(['company_name' => 'Atlas Emballages', 'region_id' => $sfax->id, 'rating_avg' => 4.6, 'reviews_count' => 3, 'sector' => 'Emballage']);
        $atlas->categories()->attach($cartons->id);
        Product::factory()->published()->count(2)->for($atlas, 'supplier')->create(['category_id' => $cartons->id]);

        $techno = SupplierProfile::factory()->visible()->create(['company_name' => 'TechNova', 'region_id' => $tunis->id, 'rating_avg' => 4.9, 'reviews_count' => 8, 'sector' => 'Informatique', 'description' => 'Infogérance et réseaux.']);
        $techno->categories()->attach($informatique->id);
        $techno->coverageRegions()->attach($sfax->id);

        SupplierProfile::factory()->visible()->create(['company_name' => 'En attente', 'validation_status' => ValidationStatus::PENDING]);

        $this->getJson('/api/suppliers')
            ->assertOk()
            ->assertJsonPath('meta.total', 2) // le fournisseur en attente n'apparaît pas
            ->assertJsonPath('data.0.company_name', 'TechNova') // mieux noté d'abord
            ->assertJsonPath('data.1.products_count', 2)
            ->assertJsonPath('data.1.categories', ['Cartonnage']);

        $this->getJson("/api/suppliers?category_id={$emballage->id}")->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $atlas->id);
        $this->getJson("/api/suppliers?region_id={$sfax->id}")->assertJsonPath('meta.total', 2); // siège ou zone couverte
        $this->getJson("/api/suppliers?region_id={$tunis->id}")->assertJsonPath('meta.total', 1);
        $this->getJson('/api/suppliers?q=emballage')->assertJsonPath('meta.total', 1);
        $this->getJson('/api/suppliers?sort=products')->assertJsonPath('data.0.id', $atlas->id);
        $this->getJson('/api/suppliers?q=100%')->assertOk()->assertJsonPath('meta.total', 0);
    }
}
