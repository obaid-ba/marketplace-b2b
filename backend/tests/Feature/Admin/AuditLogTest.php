<?php

namespace Tests\Feature\Admin;

use App\Models\AuditLog;
use App\Models\User;
use App\Services\AuditLogger;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use LogicException;
use Tests\TestCase;

/**
 * SCRUM-76 — journal d'audit des actions d'administration.
 */
class AuditLogTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->admin()->create();
    }

    public function test_un_visiteur_et_les_autres_roles_ne_voient_pas_le_journal(): void
    {
        $this->getJson('/api/admin/audit-logs')->assertUnauthorized();

        $this->actingAs(User::factory()->buyer()->create(), 'sanctum')
            ->getJson('/api/admin/audit-logs')
            ->assertForbidden();

        $this->actingAs(User::factory()->supplier()->create(), 'sanctum')
            ->getJson('/api/admin/audit-logs')
            ->assertForbidden();
    }

    public function test_l_admin_liste_les_actions_les_plus_recentes_d_abord(): void
    {
        $admin = $this->admin();
        $logger = app(AuditLogger::class);

        $logger->record($admin, 'supplier.approved', 'supplier:1');
        $logger->record($admin, 'review.hidden', 'review:9', 'Avis contraire aux règles');

        $response = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/audit-logs')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.action', 'review.hidden')
            ->assertJsonPath('data.0.target', 'review:9')
            ->assertJsonPath('data.0.reason', 'Avis contraire aux règles')
            ->assertJsonPath('data.0.admin.id', $admin->id)
            ->assertJsonPath('data.1.action', 'supplier.approved');
    }

    public function test_le_journal_est_filtrable(): void
    {
        $admin = $this->admin();
        $other = $this->admin();
        $logger = app(AuditLogger::class);

        $logger->record($admin, 'product.withdrawn', 'product:3', 'Contenu trompeur');
        $logger->record($other, 'product.withdrawn', 'product:4');
        $logger->record($admin, 'user.suspended', 'user:8', 'Fraude');

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/audit-logs?action=product.withdrawn')
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $this->actingAs($admin, 'sanctum')
            ->getJson("/api/admin/audit-logs?admin_id={$admin->id}")
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/audit-logs?target=user:')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.target', 'user:8');
    }

    public function test_la_cible_doit_exister_pour_l_administrateur(): void
    {
        $this->actingAs($this->admin(), 'sanctum')
            ->getJson('/api/admin/audit-logs?admin_id=999')
            ->assertStatus(422)
            ->assertJsonValidationErrors('admin_id');
    }

    public function test_le_journal_est_immuable_aucune_route_de_modification(): void
    {
        $admin = $this->admin();
        $log = app(AuditLogger::class)->record($admin, 'supplier.approved', 'supplier:1');

        $delete = $this->actingAs($admin, 'sanctum')
            ->deleteJson("/api/admin/audit-logs/{$log->id}");
        $this->assertContains($delete->status(), [404, 405]);

        $update = $this->actingAs($admin, 'sanctum')
            ->putJson("/api/admin/audit-logs/{$log->id}", ['action' => 'x']);
        $this->assertContains($update->status(), [404, 405]);

        $this->assertDatabaseCount('audit_logs', 1);
        $this->assertNull(AuditLog::first()->updated_at);
    }

    public function test_une_entree_ne_se_modifie_ni_ne_s_efface(): void
    {
        $log = app(AuditLogger::class)->record($this->admin(), 'supplier.validated', 'supplier_profile:1');

        foreach ([fn () => $log->update(['reason' => 'x']), fn () => $log->delete()] as $change) {
            try {
                $change();
                $this->fail('Le journal a été modifié.');
            } catch (LogicException) {
                $this->assertDatabaseHas('audit_logs', ['id' => $log->id, 'reason' => null]);
            }
        }
    }

    public function test_les_filtres_proposes_et_les_jours_tunisiens(): void
    {
        $admin = $this->admin();
        $gone = $this->admin();
        // Peu après minuit à Tunis, quel que soit le fuseau de l'application.
        $justAfterMidnight = CarbonImmutable::parse('2027-01-11 00:30', 'Africa/Tunis')->setTimezone(config('app.timezone'));
        AuditLog::create(['admin_id' => $gone->id, 'action' => 'user.suspended', 'target' => 'user:1', 'created_at' => $justAfterMidnight]);
        AuditLog::create(['admin_id' => $admin->id, 'action' => 'user.reactivated', 'target' => 'user:12', 'created_at' => '2027-01-10 10:00:00']);
        $gone->delete();

        $this->actingAs($admin, 'sanctum')->getJson('/api/admin/audit-logs?from=2027-01-11&to=2027-01-11')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.admin.name', $gone->name)
            ->assertJsonPath('actions', ['user.reactivated', 'user.suspended'])
            ->assertJsonCount(2, 'admins');
        $this->getJson('/api/admin/audit-logs?target=user:')->assertJsonCount(2, 'data');
        $this->getJson('/api/admin/audit-logs?target=%25')->assertJsonCount(0, 'data');
    }
}
