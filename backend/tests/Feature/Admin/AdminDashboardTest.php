<?php

namespace Tests\Feature\Admin;

use App\Enums\DisputeStatus;
use App\Enums\OrderStatus;
use App\Enums\ProductStatus;
use App\Enums\TenderStatus;
use App\Enums\ValidationStatus;
use App\Models\SupplierProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * SCRUM-122 / F28 — tableau de bord administrateur (story SCRUM-70).
 * Agrégats calculés côté serveur, période validée, accès réservé aux admins.
 */
class AdminDashboardTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->admin()->create();
    }

    private function withLastLogin(User $user, string $at): User
    {
        $user->forceFill(['last_login_at' => $at])->save();

        return $user;
    }

    private function validatedSupplier(): SupplierProfile
    {
        $user = User::factory()->supplier()->create();

        return $user->supplierProfile()->create([
            'company_name' => 'Fournisseur validé',
            'validation_status' => ValidationStatus::VALIDATED->value,
            'validated_at' => '2027-01-05 10:00:00',
        ]);
    }

    public function test_un_visiteur_ne_peut_pas_consulter_le_tableau_de_bord(): void
    {
        $this->getJson('/api/admin/dashboard')->assertUnauthorized();
    }

    public function test_seuls_les_admins_accedent_au_tableau_de_bord(): void
    {
        $this->actingAs(User::factory()->buyer()->create(), 'sanctum')
            ->getJson('/api/admin/dashboard')
            ->assertForbidden();

        $this->actingAs(User::factory()->supplier()->create(), 'sanctum')
            ->getJson('/api/admin/dashboard')
            ->assertForbidden();

        $this->actingAs($this->admin(), 'sanctum')
            ->getJson('/api/admin/dashboard')
            ->assertOk();
    }

    public function test_la_periode_par_defaut_couvre_les_30_derniers_jours(): void
    {
        $response = $this->actingAs($this->admin(), 'sanctum')
            ->getJson('/api/admin/dashboard')
            ->assertOk()
            ->assertJsonPath('period.days', 30)
            ->assertJsonCount(30, 'series');

        $this->assertSame('Africa/Tunis', $response->json('period.timezone'));
    }

    public function test_la_periode_est_validee(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/dashboard?from=2027-01-31&to=2027-01-01')
            ->assertStatus(422)
            ->assertJsonValidationErrors('from');

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/dashboard?from=2026-01-01&to=2027-01-31')
            ->assertStatus(422)
            ->assertJsonValidationErrors('to');

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/dashboard?from=2027-13-01')
            ->assertStatus(422)
            ->assertJsonValidationErrors('from');

        // Une période de 366 jours est acceptée.
        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/dashboard?from=2026-01-02&to=2027-01-02')
            ->assertOk()
            ->assertJsonPath('period.days', 366);
    }

    public function test_les_kpis_les_series_et_les_files_sont_agreges(): void
    {
        $admin = $this->withLastLogin($this->admin(), '2027-01-20 10:00:00');

        $buyer = User::factory()->buyer()->create();
        $this->withLastLogin($buyer, '2027-01-10 10:00:00');
        $buyerProfile = $buyer->buyerProfile()->create(['organization' => 'Acheteur']);

        // Suspendu, sans connexion, ou supprimé : ne comptent pas comme actifs.
        $this->withLastLogin(User::factory()->suspended()->create(), '2027-01-15 10:00:00');
        User::factory()->create();
        $deleted = $this->withLastLogin(User::factory()->create(), '2027-01-15 10:00:00');
        $deleted->delete();

        $supplier = $this->validatedSupplier();

        $oldestPending = User::factory()->supplier()->create();
        $oldestPending->supplierProfile()->create([
            'company_name' => 'Ancien dossier',
            'validation_status' => ValidationStatus::PENDING->value,
        ]);
        DB::table('supplier_profiles')
            ->where('company_name', 'Ancien dossier')
            ->update(['created_at' => '2027-01-02 09:00:00']);

        $recentPending = User::factory()->supplier()->create();
        $recentPending->supplierProfile()->create([
            'company_name' => 'Dossier récent',
            'validation_status' => ValidationStatus::PENDING->value,
        ]);
        DB::table('supplier_profiles')
            ->where('company_name', 'Dossier récent')
            ->update(['created_at' => '2027-01-12 09:00:00']);

        $category = DB::table('categories')->insertGetId([
            'name' => 'Informatique',
            'position' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $otherCategory = DB::table('categories')->insertGetId([
            'name' => 'Bâtiment',
            'position' => 2,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Commandes dans la période : deux clôturées (revenu) + une en cours.
        $baseOrder = [
            'buyer_id' => $buyerProfile->id,
            'supplier_id' => $supplier->id,
            'origin' => 'catalogue',
            'created_at' => '2027-01-10 10:00:00',
            'updated_at' => '2027-01-10 10:00:00',
        ];

        $closedOrderId = DB::table('orders')->insertGetId($baseOrder + [
            'total' => 1000.00,
            'status' => OrderStatus::CLOSED->value,
        ]);
        DB::table('orders')->insert($baseOrder + [
            'total' => 500.00,
            'status' => OrderStatus::CLOSED->value,
        ]);
        DB::table('orders')->insert($baseOrder + [
            'total' => 300.00,
            'status' => OrderStatus::VALIDATED->value,
        ]);
        // Hors période : ne doit pas être comptée.
        DB::table('orders')->insert([
            'buyer_id' => $buyerProfile->id,
            'supplier_id' => $supplier->id,
            'origin' => 'catalogue',
            'total' => 999.00,
            'status' => OrderStatus::CLOSED->value,
            'created_at' => '2026-12-10 10:00:00',
            'updated_at' => '2026-12-10 10:00:00',
        ]);

        // Demandes dans la période.
        foreach ([1, 2] as $index) {
            DB::table('tenders')->insert([
                'buyer_id' => $buyerProfile->id,
                'title' => "Demande {$index}",
                'description' => 'Description',
                'category_id' => $category,
                'status' => TenderStatus::OPEN->value,
                'created_at' => "2027-01-0{$index} 10:00:00",
                'updated_at' => "2027-01-0{$index} 10:00:00",
            ]);
        }

        // Produits publiés pour les catégories actives.
        DB::table('products')->insert([
            [
                'supplier_id' => $supplier->id,
                'category_id' => $category,
                'type' => 'produit',
                'title' => 'Ordinateur',
                'price' => 1200.00,
                'status' => ProductStatus::PUBLISHED->value,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'supplier_id' => $supplier->id,
                'category_id' => $category,
                'type' => 'produit',
                'title' => 'Clavier',
                'price' => 80.00,
                'status' => ProductStatus::PUBLISHED->value,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'supplier_id' => $supplier->id,
                'category_id' => $otherCategory,
                'type' => 'produit',
                'title' => 'Ciment',
                'price' => 10.00,
                'status' => ProductStatus::PUBLISHED->value,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        // Un litige ouvert et un litige décidé.
        DB::table('disputes')->insert([
            [
                'order_id' => $closedOrderId,
                'opened_by' => $buyer->id,
                'reason' => 'Produit non conforme',
                'description' => 'Détail du litige',
                'status' => DisputeStatus::OPEN->value,
                'created_at' => '2027-01-08 09:00:00',
                'updated_at' => '2027-01-08 09:00:00',
            ],
            [
                'order_id' => $closedOrderId,
                'opened_by' => $buyer->id,
                'reason' => 'Retard',
                'description' => 'Détail',
                'status' => DisputeStatus::DECIDED->value,
                'created_at' => '2027-01-09 09:00:00',
                'updated_at' => '2027-01-09 09:00:00',
            ],
        ]);

        // Inscriptions dans la période pour la courbe.
        DB::table('users')->where('id', $buyer->id)->update(['created_at' => '2027-01-03 10:00:00']);

        $response = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/dashboard?from=2027-01-01&to=2027-01-31')
            ->assertOk()
            ->assertJsonPath('period.days', 31)
            ->assertJsonPath('kpis.active_users', 2)
            ->assertJsonPath('kpis.validated_suppliers', 1)
            ->assertJsonPath('kpis.orders_count', 3)
            ->assertJsonPath('kpis.revenue', '1500.00')
            ->assertJsonPath('kpis.tenders_count', 2)
            ->assertJsonPath('validation_queue.count', 2)
            ->assertJsonPath('validation_queue.items.0.company_name', 'Ancien dossier')
            ->assertJsonPath('urgent_disputes.count', 1)
            ->assertJsonPath('urgent_disputes.items.0.reason', 'Produit non conforme')
            ->assertJsonPath('top_categories.0.name', 'Informatique')
            ->assertJsonPath('top_categories.0.products_count', 2)
            ->assertJsonPath('anomaly_alerts', [])
            ->assertJsonCount(31, 'series');

        $this->assertSame(1, collect($response->json('series'))->firstWhere('date', '2027-01-03')['signups']);
        $this->assertSame(3, collect($response->json('series'))->firstWhere('date', '2027-01-10')['orders']);
        $this->assertSame(1, collect($response->json('series'))->firstWhere('date', '2027-01-01')['tenders']);
    }

    public function test_les_comptes_supprimes_ou_suspendus_sont_exclus_des_utilisateurs_actifs(): void
    {
        $admin = $this->withLastLogin($this->admin(), '2027-01-20 10:00:00');

        $this->withLastLogin(User::factory()->supplier()->create(), '2027-01-20 10:00:00');
        $this->withLastLogin(User::factory()->suspended()->create(), '2027-01-20 10:00:00');
        $this->withLastLogin(User::factory()->deactivated()->create(), '2027-01-20 10:00:00');
        $this->withLastLogin(User::factory()->unverified()->create(), '2027-01-20 10:00:00');

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/dashboard?from=2027-01-01&to=2027-01-31')
            ->assertOk()
            // L'admin + le fournisseur actif ; les autres statuts sont exclus.
            ->assertJsonPath('kpis.active_users', 2);
    }
}
