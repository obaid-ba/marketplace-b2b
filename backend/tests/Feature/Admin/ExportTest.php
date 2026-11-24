<?php

namespace Tests\Feature\Admin;

use App\Models\Export;
use App\Models\User;
use App\Notifications\ExportReadyNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * SCRUM-75 / F28 — export des statistiques d'administration.
 */
class ExportTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        Notification::fake();
    }

    private function admin(): User
    {
        return User::factory()->admin()->create();
    }

    public function test_un_visiteur_et_les_autres_roles_ne_peuvent_pas_exporter(): void
    {
        $this->getJson('/api/admin/exports')->assertUnauthorized();

        $this->actingAs(User::factory()->buyer()->create(), 'sanctum')
            ->postJson('/api/admin/exports', [])
            ->assertForbidden();

        $this->actingAs(User::factory()->supplier()->create(), 'sanctum')
            ->getJson('/api/admin/exports')
            ->assertForbidden();
    }

    public function test_un_export_csv_est_genere_et_l_admin_est_notifie(): void
    {
        $admin = $this->admin();

        $response = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/exports', [
                'from' => '2027-01-01',
                'to' => '2027-01-31',
                'format' => 'csv',
            ])
            ->assertStatus(202)
            ->assertJsonPath('export.status', Export::STATUS_READY)
            ->assertJsonPath('export.format', 'csv');

        $export = Export::findOrFail($response->json('export.id'));

        $this->assertSame($admin->id, $export->user_id);
        $this->assertSame('2027-01-01', $export->period_from->toDateString());
        $this->assertSame('2027-01-31', $export->period_to->toDateString());
        $this->assertNotNull($export->file_path);
        Storage::disk('local')->assertExists($export->file_path);

        Notification::assertSentTo($admin, ExportReadyNotification::class);
    }

    public function test_le_format_xlsx_est_refuse_tant_que_la_dependance_n_est_pas_validee(): void
    {
        $response = $this->actingAs($this->admin(), 'sanctum')
            ->postJson('/api/admin/exports', ['format' => 'xlsx'])
            ->assertStatus(422);

        $this->assertStringContainsString('Q7', $response->json('message'));

        $this->assertDatabaseCount('exports', 0);
    }

    public function test_l_admin_liste_et_telecharge_ses_exports(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/exports', ['from' => '2027-01-01', 'to' => '2027-01-31'])
            ->assertStatus(202);

        $export = Export::firstOrFail();

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/exports')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $export->id);

        $download = $this->actingAs($admin, 'sanctum')
            ->get("/api/admin/exports/{$export->id}/download")
            ->assertOk();

        $this->assertStringContainsString('section;libelle;valeur', $download->streamedContent());
    }

    public function test_un_admin_ne_telecharge_pas_l_export_d_un_autre(): void
    {
        $owner = $this->admin();

        $this->actingAs($owner, 'sanctum')
            ->postJson('/api/admin/exports', [])
            ->assertStatus(202);

        $export = Export::firstOrFail();

        $this->actingAs($this->admin(), 'sanctum')
            ->get("/api/admin/exports/{$export->id}/download")
            ->assertNotFound();
    }
}
