<?php

namespace Tests\Feature\Admin;

use App\Models\Category;
use App\Models\Export;
use App\Models\Product;
use App\Models\User;
use App\Notifications\ExportReadyNotification;
use App\Services\Export\CsvWriter;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;
use ZipArchive;

/**
 * SCRUM-75 / F28 — export des statistiques d'administration.
 */
class ExportTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();

        parent::tearDown();
    }

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

    public function test_un_export_xlsx_contient_les_indicateurs_choisis(): void
    {
        CarbonImmutable::setTestNow('2027-01-20 12:00:00');
        $admin = $this->admin();
        DB::table('users')->where('id', $admin->id)->update(['created_at' => '2027-01-10 10:00:00']);
        Category::factory()->create(['name' => '=1+1 & <Bois>']);
        $product = Product::factory()->published()->create(['category_id' => Category::first()->id]);
        DB::table('users')->where('id', $product->supplier->user_id)->update(['created_at' => '2026-12-01 10:00:00']);

        $response = $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/exports', ['from' => '2027-01-01', 'to' => '2027-01-31', 'format' => 'xlsx', 'indicators' => ['signups', 'categories']])
            ->assertStatus(202)
            ->assertJsonPath('export.status', Export::STATUS_READY);

        $export = Export::findOrFail($response->json('export.id'));
        $this->assertStringEndsWith('.xlsx', $export->file_path);

        $zip = new ZipArchive;
        $this->assertTrue($zip->open(Storage::disk('local')->path($export->file_path)));
        foreach (['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet3.xml'] as $part) {
            $this->assertNotFalse(simplexml_load_string((string) $zip->getFromName($part)), $part);
        }
        $this->assertStringContainsString('Par jour', $zip->getFromName('xl/workbook.xml'));
        $daily = $zip->getFromName('xl/worksheets/sheet2.xml');
        $this->assertStringContainsString('Inscriptions', $daily);
        $this->assertStringNotContainsString('Commandes', $daily);
        $this->assertStringContainsString('=1+1 &amp; &lt;Bois&gt;', $zip->getFromName('xl/worksheets/sheet3.xml'));
        $zip->close();

        $this->actingAs($admin, 'sanctum')->get("/api/admin/exports/{$export->id}/download")
            ->assertOk()
            ->assertDownload('statistiques-2027-01-01-2027-01-31.xlsx');
    }

    public function test_le_csv_neutralise_les_formules_et_utilise_la_virgule(): void
    {
        $csv = app(CsvWriter::class)->build(['Essai' => [['=cmd()', 12.5], ['Texte', 3]], 'Suite' => [['a']]]);

        $this->assertSame("\xEF\xBB\xBFEssai\n'=cmd();12,5\nTexte;3\n\nSuite\na\n", $csv);
    }

    public function test_les_indicateurs_sont_controles(): void
    {
        $this->actingAs($this->admin(), 'sanctum');

        $this->postJson('/api/admin/exports', ['indicators' => []])->assertJsonValidationErrors('indicators');
        $this->postJson('/api/admin/exports', ['indicators' => ['mots_de_passe']])->assertJsonValidationErrors('indicators.0');
        $this->postJson('/api/admin/exports', ['format' => 'exe'])->assertJsonValidationErrors('format');
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
            ->assertJsonPath('data.0.id', $export->id)
            ->assertJsonPath('data.0.period_from', '2027-01-01')
            ->assertJsonPath('data.0.period_to', '2027-01-31');

        $download = $this->actingAs($admin, 'sanctum')
            ->get("/api/admin/exports/{$export->id}/download")
            ->assertOk();

        $content = $download->streamedContent();
        $this->assertStringContainsString('Indicateur;Valeur', $content);
        $this->assertStringContainsString('2027-01-31;0;0;0;0', $content);
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
