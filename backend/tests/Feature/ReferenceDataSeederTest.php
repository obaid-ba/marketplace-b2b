<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Region;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Les données de référence doivent exister même sans les données de démonstration :
 * sans régions ni catégories, les formulaires d'inscription restent inutilisables.
 */
class ReferenceDataSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_le_seeder_insere_toujours_les_regions_et_categories(): void
    {
        $this->seed();

        $this->assertSame(24, Region::count());
        $this->assertGreaterThan(0, Category::count());
        $this->assertSame(0, User::count(), 'Aucun compte de démonstration ne doit être créé.');
    }

    public function test_le_seeder_ne_cree_pas_de_doublons_quand_on_le_relance(): void
    {
        $this->seed();
        $regions = Region::count();
        $categories = Category::count();

        $this->seed();

        $this->assertSame($regions, Region::count());
        $this->assertSame($categories, Category::count());
    }

    public function test_l_api_expose_les_regions_apres_le_seeder(): void
    {
        $this->seed();

        $this->getJson('/api/reference/regions')
            ->assertOk()
            ->assertJsonCount(24)
            ->assertJsonFragment(['name' => 'Tunis']);
    }
}
