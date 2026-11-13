<?php

namespace Tests\Feature;

use App\Enums\ValidationStatus;
use App\Models\AuditLog;
use App\Models\SupplierDocument;
use App\Models\SupplierProfile;
use App\Models\User;
use App\Notifications\SupplierValidationNotification;
use App\Services\SupplierProfileService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Validation ou refus des nouveaux fournisseurs par l'administrateur (SCRUM-31).
 *
 * Couvre les 5 critères d'acceptation Jira :
 * 1. File des demandes (triée created_at ASC, filtrable par statut, en attente par défaut)
 * 2. Consultation et téléchargement des documents joints (supplier_documents)
 * 3. Acceptation (validation_status=validé, is_published=true, validated_by/at, documents, AuditLog, notification)
 * 4. Refus sans motif ou invalide rejeté en 422
 * 5. Refus avec motif (validation_status=refusé, is_published=false, rejection_reason, validated_by/at, documents, AuditLog, notification)
 */
class SupplierValidationTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake(SupplierProfileService::DOCUMENT_DISK);
        Notification::fake();

        $this->admin = User::factory()->admin()->create();
    }

    private function actingAsAdmin(): void
    {
        Sanctum::actingAs($this->admin);
    }

    // --- Sécurité et Contrôle d'accès ---

    public function test_un_visiteur_non_authentifie_recoit_401(): void
    {
        $this->getJson('/api/admin/suppliers')->assertUnauthorized();
    }

    public function test_un_fournisseur_ou_un_porteur_ne_peut_pas_acceder_au_backoffice(): void
    {
        $supplier = User::factory()->supplier()->create();
        Sanctum::actingAs($supplier);
        $this->getJson('/api/admin/suppliers')->assertForbidden();

        $buyer = User::factory()->buyer()->create();
        Sanctum::actingAs($buyer);
        $this->getJson('/api/admin/suppliers')->assertForbidden();
    }

    // --- Critère 1 : File des demandes triée et filtrable ---

    public function test_1_file_des_demandes_triee_de_la_plus_ancienne_a_la_plus_recente(): void
    {
        $this->actingAsAdmin();

        $older = SupplierProfile::factory()->pending()->create([
            'created_at' => now()->subDays(5),
            'company_name' => 'Entreprise Ancienne',
        ]);
        $newer = SupplierProfile::factory()->pending()->create([
            'created_at' => now()->subDay(),
            'company_name' => 'Entreprise Récente',
        ]);
        // Un profil validé ne doit pas apparaître par défaut dans la file des demandes « en attente »
        SupplierProfile::factory()->validated()->create();

        $response = $this->getJson('/api/admin/suppliers')->assertOk();

        $data = $response->json('data');
        $this->assertCount(2, $data);
        $this->assertSame($older->id, $data[0]['id']);
        $this->assertSame($newer->id, $data[1]['id']);
    }

    public function test_1_file_des_demandes_filtrable_par_statut(): void
    {
        $this->actingAsAdmin();

        SupplierProfile::factory()->pending()->create();
        SupplierProfile::factory()->validated()->create();
        SupplierProfile::factory()->rejected()->create();

        // Filtre validés (terme français et anglais)
        $this->getJson('/api/admin/suppliers?status=validé')
            ->assertOk()
            ->assertJsonCount(1, 'data');
        $this->getJson('/api/admin/suppliers?status=validated')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        // Filtre refusés
        $this->getJson('/api/admin/suppliers?status=refusé')
            ->assertOk()
            ->assertJsonCount(1, 'data');
        $this->getJson('/api/admin/suppliers?status=rejected')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        // Tous les statuts
        $this->getJson('/api/admin/suppliers?status=all')
            ->assertOk()
            ->assertJsonCount(3, 'data');
    }

    // --- Critère 2 : Consultation des documents joints ---

    public function test_2_consultation_des_documents_joints_et_telechargement(): void
    {
        $this->actingAsAdmin();

        $supplier = SupplierProfile::factory()->pending()->create();
        $file = UploadedFile::fake()->create('registre_commerce.pdf', 150, 'application/pdf');
        $path = $file->store("supplier-documents/{$supplier->id}", SupplierProfileService::DOCUMENT_DISK);

        $document = $supplier->documents()->create([
            'type' => SupplierDocument::TYPE_COMMERCIAL_REGISTER,
            'file_path' => $path,
            'status' => ValidationStatus::PENDING,
            'submitted_at' => now(),
        ]);

        // Détail du fournisseur incluant la liste des documents
        $this->getJson("/api/admin/suppliers/{$supplier->id}")
            ->assertOk()
            ->assertJsonPath('supplier.id', $supplier->id)
            ->assertJsonPath('supplier.company_name', $supplier->company_name)
            ->assertJsonCount(1, 'supplier.documents')
            ->assertJsonPath('supplier.documents.0.id', $document->id);

        // Téléchargement du fichier
        $downloadResponse = $this->get("/api/admin/suppliers/documents/{$document->id}/download");
        $downloadResponse->assertOk();
        $this->assertTrue(
            str_contains(
                (string) $downloadResponse->headers->get('content-disposition'),
                'Registre de commerce.pdf'
            )
        );
    }

    // --- Critères 3, 4 et 5 : Validation, Refus, AuditLog et Notification ---

    public function test_3_validation_d_un_fournisseur_et_tracabilite_audit_log_et_notification(): void
    {
        $this->actingAsAdmin();

        $supplier = SupplierProfile::factory()->pending()->create();
        $doc = $supplier->documents()->create([
            'type' => SupplierDocument::TYPE_COMMERCIAL_REGISTER,
            'file_path' => 'supplier-documents/test.pdf',
            'status' => ValidationStatus::PENDING,
            'submitted_at' => now(),
        ]);

        $response = $this->postJson("/api/admin/suppliers/{$supplier->id}/approve")
            ->assertOk()
            ->assertJsonPath('message', 'Le dossier fournisseur a été validé avec succès.');

        $supplier->refresh();

        // 3. Critère : SupplierProfile mis à jour
        $this->assertSame(ValidationStatus::VALIDATED, $supplier->validation_status);
        $this->assertTrue($supplier->is_published);
        $this->assertNull($supplier->rejection_reason);
        $this->assertSame($this->admin->id, $supplier->validated_by);
        $this->assertNotNull($supplier->validated_at);

        // 3. Critère : Statut des documents mis à jour
        $this->assertSame(ValidationStatus::VALIDATED, $doc->refresh()->status);

        // 5. Critère : Traçabilité dans AuditLog
        $this->assertDatabaseHas('audit_logs', [
            'admin_id' => $this->admin->id,
            'action' => 'supplier.validated',
            'target' => "supplier_profile:{$supplier->id}",
            'reason' => null,
        ]);

        // 4. Critère : Notification envoyée au fournisseur
        Notification::assertSentTo(
            $supplier->user,
            SupplierValidationNotification::class,
            fn ($notification) => $notification->status === ValidationStatus::VALIDATED
        );
    }

    public function test_4_refus_sans_motif_rejete_en_422(): void
    {
        $this->actingAsAdmin();

        $supplier = SupplierProfile::factory()->pending()->create();

        // Motif absent
        $this->postJson("/api/admin/suppliers/{$supplier->id}/reject", [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['reason']);

        // Motif trop court (< 5 caractères)
        $this->postJson("/api/admin/suppliers/{$supplier->id}/reject", [
            'reason' => 'non',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['reason']);
    }

    public function test_5_refus_avec_motif_valide_en_200_et_tracabilite_audit_log_et_notification(): void
    {
        $this->actingAsAdmin();

        $supplier = SupplierProfile::factory()->pending()->create();
        $doc = $supplier->documents()->create([
            'type' => SupplierDocument::TYPE_COMMERCIAL_REGISTER,
            'file_path' => 'supplier-documents/test.pdf',
            'status' => ValidationStatus::PENDING,
            'submitted_at' => now(),
        ]);

        $reason = 'Le registre de commerce est expiré et la CIN du gérant est illisible.';

        $response = $this->postJson("/api/admin/suppliers/{$supplier->id}/reject", [
            'reason' => $reason,
        ])
            ->assertOk()
            ->assertJsonPath('message', 'Le dossier fournisseur a été refusé.');

        $supplier->refresh();

        // 3. Critère : SupplierProfile mis à jour en refusé
        $this->assertSame(ValidationStatus::REJECTED, $supplier->validation_status);
        $this->assertFalse($supplier->is_published);
        $this->assertSame($reason, $supplier->rejection_reason);
        $this->assertSame($this->admin->id, $supplier->validated_by);
        $this->assertNotNull($supplier->validated_at);

        // 3. Critère : Documents marqués refusés
        $this->assertSame(ValidationStatus::REJECTED, $doc->refresh()->status);

        // 5. Critère : Traçabilité dans AuditLog avec motif
        $this->assertDatabaseHas('audit_logs', [
            'admin_id' => $this->admin->id,
            'action' => 'supplier.rejected',
            'target' => "supplier_profile:{$supplier->id}",
            'reason' => $reason,
        ]);

        // 4. Critère : Notification envoyée au fournisseur avec motif
        Notification::assertSentTo(
            $supplier->user,
            SupplierValidationNotification::class,
            fn ($notification) => $notification->status === ValidationStatus::REJECTED && $notification->reason === $reason
        );
    }
}
