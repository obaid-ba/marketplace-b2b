<?php

namespace Tests\Feature\Buyer;

use App\Enums\OrderStatus;
use App\Enums\QuoteStatus;
use App\Enums\TenderStatus;
use App\Models\SupplierProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * SCRUM-121 / F27 — tableau de bord porteur de projet (story SCRUM-69).
 */
class BuyerDashboardTest extends TestCase
{
    use RefreshDatabase;

    private function buyer(): array
    {
        $user = User::factory()->buyer()->create();
        $profile = $user->buyerProfile()->create(['organization' => 'Porteur']);

        return [$user, $profile];
    }

    private function supplier(): SupplierProfile
    {
        $user = User::factory()->supplier()->create();

        return $user->supplierProfile()->create(['company_name' => 'Fournisseur']);
    }

    public function test_un_visiteur_et_les_autres_roles_n_accedent_pas_au_tableau_de_bord(): void
    {
        $this->getJson('/api/buyer/dashboard')->assertUnauthorized();

        $this->actingAs(User::factory()->supplier()->create(), 'sanctum')
            ->getJson('/api/buyer/dashboard')
            ->assertForbidden();

        $this->actingAs(User::factory()->admin()->create(), 'sanctum')
            ->getJson('/api/buyer/dashboard')
            ->assertForbidden();
    }

    public function test_un_compte_sans_profil_acheteur_recoit_une_erreur_claire(): void
    {
        $this->actingAs(User::factory()->buyer()->create(), 'sanctum')
            ->getJson('/api/buyer/dashboard')
            ->assertForbidden()
            ->assertJsonPath('message', 'Profil acheteur introuvable.');
    }

    public function test_la_periode_par_defaut_et_sa_validation(): void
    {
        [$user] = $this->buyer();

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/buyer/dashboard')
            ->assertOk()
            ->assertJsonPath('period.days', 30)
            ->assertJsonCount(30, 'series')
            ->assertJsonPath('period.timezone', 'Africa/Tunis');

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/buyer/dashboard?from=2027-02-01&to=2027-01-01')
            ->assertStatus(422)
            ->assertJsonValidationErrors('from');

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/buyer/dashboard?from=2026-01-01&to=2027-01-31')
            ->assertStatus(422)
            ->assertJsonValidationErrors('to');
    }

    public function test_les_indicateurs_les_demandes_les_devis_et_les_favoris_sont_agreges(): void
    {
        [$user, $buyer] = $this->buyer();
        $supplier = $this->supplier();

        $category = DB::table('categories')->insertGetId([
            'name' => 'Emballage',
            'position' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $baseOrder = [
            'buyer_id' => $buyer->id,
            'supplier_id' => $supplier->id,
            'origin' => 'catalogue',
            'created_at' => '2027-01-10 10:00:00',
            'updated_at' => '2027-01-10 10:00:00',
        ];

        DB::table('orders')->insert($baseOrder + [
            'total' => 1000.00,
            'status' => OrderStatus::CLOSED->value,
        ]);
        DB::table('orders')->insert($baseOrder + [
            'total' => 500.00,
            'status' => OrderStatus::VALIDATED->value,
        ]);
        // Hors période.
        DB::table('orders')->insert(array_merge($baseOrder, [
            'total' => 999.00,
            'status' => OrderStatus::CLOSED->value,
            'created_at' => '2026-12-10 10:00:00',
            'updated_at' => '2026-12-10 10:00:00',
        ]));

        $openTender = DB::table('tenders')->insertGetId([
            'buyer_id' => $buyer->id,
            'title' => 'Achat de cartons',
            'description' => 'Description',
            'category_id' => $category,
            'status' => TenderStatus::OPEN->value,
            'desired_deadline' => '2027-02-15',
            'budget' => 2500.00,
            'created_at' => '2027-01-05 10:00:00',
            'updated_at' => '2027-01-05 10:00:00',
        ]);

        $closedTender = DB::table('tenders')->insertGetId([
            'buyer_id' => $buyer->id,
            'title' => 'Demande clôturée',
            'description' => 'Description',
            'category_id' => $category,
            'status' => TenderStatus::CLOSED->value,
            'created_at' => '2027-01-06 10:00:00',
            'updated_at' => '2027-01-06 10:00:00',
        ]);

        // Deux devis en attente sur la demande ouverte (un fournisseur par devis),
        // un devis accepté sur la clôturée.
        $secondSupplier = $this->supplier();
        foreach ([QuoteStatus::SENT, QuoteStatus::IN_NEGOTIATION] as $index => $status) {
            DB::table('quotes')->insert([
                'tender_id' => $openTender,
                'supplier_id' => $index === 0 ? $supplier->id : $secondSupplier->id,
                'amount' => 2000.00 + $index * 100,
                'delivery_days' => 5 + $index,
                'status' => $status->value,
                'created_at' => '2027-01-0'.(7 + $index).' 10:00:00',
                'updated_at' => '2027-01-0'.(7 + $index).' 10:00:00',
            ]);
        }

        DB::table('quotes')->insert([
            'tender_id' => $closedTender,
            'supplier_id' => $supplier->id,
            'amount' => 900.00,
            'delivery_days' => 3,
            'status' => QuoteStatus::ACCEPTED->value,
            'created_at' => '2027-01-08 10:00:00',
            'updated_at' => '2027-01-08 10:00:00',
        ]);

        // Demande d'un autre acheteur : ne doit jamais apparaître.
        $otherBuyer = User::factory()->buyer()->create()->buyerProfile()->create(['organization' => 'Autre']);
        DB::table('tenders')->insert([
            'buyer_id' => $otherBuyer->id,
            'title' => 'Demande tierce',
            'description' => 'Description',
            'category_id' => $category,
            'status' => TenderStatus::OPEN->value,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('favorites')->insert([
            'buyer_id' => $buyer->id,
            'supplier_id' => $supplier->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/buyer/dashboard?from=2027-01-01&to=2027-01-31')
            ->assertOk()
            ->assertJsonPath('period.days', 31)
            ->assertJsonPath('kpis.spending', '1500.00')
            ->assertJsonPath('kpis.orders_count', 2)
            ->assertJsonPath('kpis.orders_in_progress', 1)
            ->assertJsonPath('kpis.orders_closed', 1)
            ->assertJsonPath('kpis.published_requests', 1)
            ->assertJsonPath('kpis.pending_quotes', 2)
            ->assertJsonPath('kpis.favorite_suppliers', 1)
            ->assertJsonPath('published_requests.0.title', 'Achat de cartons')
            ->assertJsonPath('published_requests.0.quotes_received', 2)
            ->assertJsonPath('published_requests.0.desired_deadline', '2027-02-15')
            ->assertJsonCount(2, 'pending_quotes')
            ->assertJsonPath('favorite_suppliers.0.company_name', 'Fournisseur')
            ->assertJsonCount(3, 'latest_orders')
            ->assertJsonCount(31, 'series');

        $this->assertSame(2, collect($response->json('series'))->firstWhere('date', '2027-01-10')['orders']);
        $this->assertSame(1500.0, (float) collect($response->json('series'))->firstWhere('date', '2027-01-10')['spending']);
    }
}
