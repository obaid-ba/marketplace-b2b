<?php

namespace Tests\Feature\Catalog;

use App\Models\Product;
use App\Models\Review;
use Database\Seeders\CatalogueDemoSeeder;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Données de démonstration du catalogue (sprint 2).
 */
class CatalogueDemoSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_le_seeder_remplit_le_catalogue_sans_doublons(): void
    {
        $this->seed(DatabaseSeeder::class);
        $this->seed(CatalogueDemoSeeder::class);
        $count = Product::count();

        $this->seed(CatalogueDemoSeeder::class);

        $this->assertSame($count, Product::count());
        $this->assertSame(6, Review::count());
        $this->assertDatabaseCount('favorites', 6);
        $this->assertSame(17, Product::query()->visible()->count());
        $this->getJson('/api/products?q=carton')
            ->assertOk()
            ->assertJsonPath('data.0.title', 'Cartons ondulés sur mesure');
    }
}
