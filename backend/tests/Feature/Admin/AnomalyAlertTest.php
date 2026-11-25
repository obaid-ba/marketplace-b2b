<?php

namespace Tests\Feature\Admin;

use App\Enums\AnomalyStatus;
use App\Enums\OrderStatus;
use App\Models\AnomalyAlert;
use App\Models\SupplierProfile;
use App\Models\User;
use App\Services\AnomalyDetector;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Détecter les comptes et commandes au comportement inhabituel (SCRUM-86).
 */
class AnomalyAlertTest extends TestCase
{
    use RefreshDatabase;

    private SupplierProfile $supplier;

    protected function setUp(): void
    {
        parent::setUp();

        $this->supplier = SupplierProfile::factory()->visible()->create();
    }

    private function buyer(array $attributes = []): User
    {
        $buyer = User::factory()->buyer()->create(['created_at' => now()->subYear(), ...$attributes]);
        $buyer->buyerProfile()->create(['organization' => 'Acheteur']);

        return $buyer;
    }

    private function order(User $buyer, float $total, $createdAt = null): int
    {
        return DB::table('orders')->insertGetId([
            'buyer_id' => $buyer->buyerProfile->id,
            'supplier_id' => $this->supplier->id,
            'origin' => 'catalogue',
            'total' => $total,
            'status' => OrderStatus::VALIDATED->value,
            'created_at' => $createdAt ?? now(),
            'updated_at' => now(),
        ]);
    }

    private function detect(): int
    {
        return app(AnomalyDetector::class)->run();
    }

    public function test_pic_de_commandes_d_un_compte(): void
    {
        $buyer = $this->buyer();
        foreach (range(1, 5) as $i) {
            $this->order($buyer, 100);
        }
        $this->order($this->buyer(), 100); // un acheteur normal

        $this->assertSame(1, $this->detect());

        $alert = AnomalyAlert::query()->sole();
        $this->assertSame(AnomalyAlert::TARGET_ACCOUNT, $alert->target_type);
        $this->assertSame($buyer->id, $alert->target_id);
        $this->assertSame(AnomalyAlert::TYPE_ORDER_SPIKE, $alert->anomaly_type);
        $this->assertSame(AnomalyStatus::NEW, $alert->status);
        $this->assertEquals(75, $alert->score);

        // Relancer sans changement ne crée pas de doublon ; une 6e commande relève le score.
        $this->assertSame(0, $this->detect());
        $this->order($buyer, 100);
        $this->assertSame(1, $this->detect());
        $this->assertEquals(90, $alert->fresh()->score);
        $this->assertSame(1, AnomalyAlert::query()->count());
    }

    public function test_avis_en_rafale_et_litiges_repetes(): void
    {
        $buyer = $this->buyer();
        foreach (range(1, 3) as $i) {
            $order = $this->order($buyer, 50, now()->subDays(2));
            DB::table('reviews')->insert([
                'order_id' => $order, 'buyer_id' => $buyer->buyerProfile->id, 'supplier_id' => $this->supplier->id,
                'rating' => 1, 'status' => 'publié', 'created_at' => now(), 'updated_at' => now(),
            ]);
            DB::table('disputes')->insert([
                'order_id' => $order, 'opened_by' => $buyer->id, 'reason' => 'autre', 'description' => 'Problème',
                'status' => 'ouvert', 'created_at' => now(), 'updated_at' => now(),
            ]);
        }

        $this->detect();

        $types = AnomalyAlert::query()->where('target_id', $buyer->id)->pluck('anomaly_type')->all();
        $this->assertEqualsCanonicalizing([AnomalyAlert::TYPE_REVIEW_BURST, AnomalyAlert::TYPE_REPEATED_DISPUTES], $types);
    }

    public function test_montant_inhabituel_et_grosse_commande_d_un_nouveau_compte(): void
    {
        $regular = $this->buyer();
        foreach (range(1, 10) as $i) {
            $this->order($regular, 200, now()->subMonths(2));
        }
        $big = $this->order($regular, 1500);
        $newcomer = $this->buyer(['created_at' => now()->subHours(3)]);
        $fresh = $this->order($newcomer, 6000);

        $this->detect();

        $this->assertDatabaseHas('anomaly_alerts', ['target_type' => 'commande', 'target_id' => $big, 'anomaly_type' => AnomalyAlert::TYPE_UNUSUAL_AMOUNT]);
        $this->assertDatabaseHas('anomaly_alerts', ['target_type' => 'commande', 'target_id' => $fresh, 'anomaly_type' => AnomalyAlert::TYPE_NEW_ACCOUNT_LARGE_ORDER]);
    }

    public function test_l_admin_traite_ou_ignore_une_alerte_trace_dans_l_audit(): void
    {
        $admin = User::factory()->admin()->create();
        $buyer = $this->buyer(['name' => 'Karim Test']);
        foreach (range(1, 5) as $i) {
            $this->order($buyer, 100);
        }
        $this->actingAs($admin, 'sanctum')->postJson('/api/admin/anomalies/scan')->assertOk()->assertJsonPath('count', 1);

        $alertId = $this->getJson('/api/admin/anomalies')
            ->assertOk()
            ->assertJsonPath('counts.new', 1)
            ->assertJsonPath('data.0.target_label', "Karim Test ({$buyer->email})")
            ->json('data.0.id');

        // Visible sur le tableau de bord.
        $this->getJson('/api/admin/dashboard')->assertOk()->assertJsonPath('anomaly_alerts.0.id', $alertId);

        $this->postJson("/api/admin/anomalies/{$alertId}/handle", ['note' => 'Client vérifié par téléphone'])
            ->assertOk()
            ->assertJsonPath('alert.status', AnomalyStatus::HANDLED->value);
        $this->postJson("/api/admin/anomalies/{$alertId}/ignore")->assertUnprocessable();
        $this->assertDatabaseHas('audit_logs', ['action' => 'anomaly.handled', 'target' => "anomaly:{$alertId}"]);

        // Même situation juste après une décision : pas de nouvelle alerte.
        $this->assertSame(0, app(AnomalyDetector::class)->run());
        $this->getJson('/api/admin/anomalies?status=traitée')->assertJsonPath('data.0.id', $alertId);
    }

    public function test_reserve_a_l_admin_et_commande_planifiee(): void
    {
        $this->actingAs($this->buyer(), 'sanctum')->getJson('/api/admin/anomalies')->assertForbidden();

        $this->artisan('anomalies:detect')->expectsOutputToContain('alerte(s)')->assertSuccessful();
    }
}
