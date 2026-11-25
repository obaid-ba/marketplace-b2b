<?php

namespace Tests\Feature\Catalog;

use App\Enums\OrderStatus;
use App\Models\AnomalyAlert;
use App\Models\Dispute;
use App\Models\Message;
use App\Models\Order;
use App\Models\Product;
use App\Models\ReviewReport;
use App\Models\SupplierProfile;
use App\Models\Tender;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\FullDemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Démonstration complète : chaque écran a des données, et le seeder peut être relancé.
 */
class FullDemoSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_la_demonstration_remplit_tous_les_ecrans_et_se_relance_sans_doublon(): void
    {
        Storage::fake('public');
        Storage::fake('local');

        $this->seed(DatabaseSeeder::class);
        $this->seed(FullDemoSeeder::class);

        $this->assertGreaterThanOrEqual(40, Product::query()->visible()->count());
        $this->assertSame(0, Product::query()->visible()->doesntHave('images')->count(), 'Produit publié sans photo');
        $this->assertSame(0, SupplierProfile::query()->visibleInCatalog()->whereNull('logo')->count(), 'Fournisseur sans logo');
        Storage::disk('public')->assertExists('products/demo/cartons-ondules.jpg');

        $this->assertNotNull(User::query()->where('email', 'admin@marketplace.test')->first());
        $this->assertSame(1, SupplierProfile::query()->where('validation_status', 'en attente')->count());

        $statuses = Order::query()->pluck('status')->map(fn ($status) => $status->value)->unique();
        foreach ([OrderStatus::VALIDATED, OrderStatus::SHIPPED, OrderStatus::DELIVERED, OrderStatus::CLOSED] as $status) {
            $this->assertContains($status->value, $statuses, "Aucune commande « {$status->value} »");
        }

        $this->assertGreaterThanOrEqual(2, Tender::query()->open()->has('quotes')->count());
        $this->assertSame(2, Dispute::query()->count());
        $this->assertGreaterThan(0, Message::query()->count());
        $this->assertSame(1, ReviewReport::query()->count());
        $this->assertGreaterThan(0, AnomalyAlert::query()->count());
        $this->assertDatabaseHas('documents', ['type' => 'facture']);

        // La fiche fournisseur affiche le résumé des avis.
        $atlas = SupplierProfile::query()->where('company_name', 'Atlas Emballages')->firstOrFail();
        $this->getJson("/api/suppliers/{$atlas->id}")->assertOk()->assertJsonPath('ai_summary.reviews_count', fn ($count) => $count >= 3);

        // Relancer : pas de doublon.
        $orders = Order::query()->count();
        $this->seed(FullDemoSeeder::class);
        $this->assertSame($orders, Order::query()->count());
        $this->assertSame(0, Product::query()->visible()->doesntHave('images')->count());
    }
}
