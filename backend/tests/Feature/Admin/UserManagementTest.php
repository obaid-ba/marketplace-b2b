<?php

namespace Tests\Feature\Admin;

use App\Enums\UserStatus;
use App\Models\User;
use App\Notifications\AccountStatusNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * SCRUM-71 — gestion des comptes utilisateurs par l'administrateur.
 */
class UserManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();
    }

    private function admin(): User
    {
        return User::factory()->admin()->create();
    }

    public function test_la_gestion_des_comptes_est_reservee_a_l_admin(): void
    {
        $this->getJson('/api/admin/users')->assertUnauthorized();

        $this->actingAs(User::factory()->buyer()->create(), 'sanctum')
            ->getJson('/api/admin/users')
            ->assertForbidden();

        $this->actingAs(User::factory()->supplier()->create(), 'sanctum')
            ->postJson('/api/admin/users/1/suspend', ['reason' => 'Test'])
            ->assertForbidden();
    }

    public function test_la_liste_est_filtrable_par_recherche_role_et_statut(): void
    {
        $admin = $this->admin();
        $supplier = User::factory()->supplier()->create(['name' => 'Atlas Fournitures', 'email' => 'atlas@example.test']);
        User::factory()->suspended()->create(['name' => 'Compte suspendu']);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/users?q=atlas')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $supplier->id);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/users?role=supplier')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/users?status='.urlencode(UserStatus::SUSPENDED->value))
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Compte suspendu');
    }

    public function test_suspendre_un_compte_revoque_ses_jetons_notifie_et_audite(): void
    {
        $admin = $this->admin();
        $target = User::factory()->buyer()->create();
        $target->createToken('web');
        $this->assertDatabaseCount('personal_access_tokens', 1);

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/users/{$target->id}/suspend", [])
            ->assertStatus(422)
            ->assertJsonValidationErrors('reason');

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/users/{$target->id}/suspend", [
                'reason' => 'Comportement frauduleux',
            ])
            ->assertOk()
            ->assertJsonPath('user.status', UserStatus::SUSPENDED->value);

        $this->assertSame(UserStatus::SUSPENDED, $target->fresh()->status);
        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->assertDatabaseHas('audit_logs', [
            'admin_id' => $admin->id,
            'action' => 'user.suspended',
            'target' => "user:{$target->id}",
            'reason' => 'Comportement frauduleux',
        ]);
        Notification::assertSentTo($target, AccountStatusNotification::class);

        // Le compte suspendu ne peut plus se connecter.
        $this->postJson('/api/auth/login', [
            'email' => $target->email,
            'password' => 'password',
        ])
            ->assertStatus(403)
            ->assertJsonPath('reason', 'suspended');
    }

    public function test_un_admin_ne_peut_pas_se_suspendre_lui_meme(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/users/{$admin->id}/suspend", ['reason' => 'Erreur de manipulation'])
            ->assertStatus(422);
    }

    public function test_reactiver_un_compte_le_repasse_actif(): void
    {
        $admin = $this->admin();
        $target = User::factory()->suspended()->create();

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/users/{$target->id}/reactivate")
            ->assertOk()
            ->assertJsonPath('user.status', UserStatus::ACTIVE->value);

        $this->assertSame(UserStatus::ACTIVE, $target->fresh()->status);
        $this->assertDatabaseHas('audit_logs', [
            'admin_id' => $admin->id,
            'action' => 'user.reactivated',
            'target' => "user:{$target->id}",
        ]);
        Notification::assertSentTo($target, AccountStatusNotification::class);
    }

    public function test_supprimer_un_compte_est_une_suppression_douce_motivee_et_auditee(): void
    {
        $admin = $this->admin();
        $target = User::factory()->buyer()->create();
        $target->createToken('web');

        $this->actingAs($admin, 'sanctum')
            ->deleteJson("/api/admin/users/{$target->id}", ['reason' => 'Demande de suppression'])
            ->assertOk();

        $this->assertSoftDeleted('users', ['id' => $target->id]);
        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->assertDatabaseHas('audit_logs', [
            'admin_id' => $admin->id,
            'action' => 'user.deleted',
            'target' => "user:{$target->id}",
            'reason' => 'Demande de suppression',
        ]);
        Notification::assertSentTo($target, AccountStatusNotification::class);

        // Le compte supprimé n'apparaît plus par défaut, mais reste consultable.
        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/users')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/users?include_deleted=1')
            ->assertOk()
            ->assertJsonCount(2, 'data');
    }
}
