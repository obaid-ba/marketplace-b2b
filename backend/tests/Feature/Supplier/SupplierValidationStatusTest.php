<?php

namespace Tests\Feature\Supplier;

use App\Enums\ValidationStatus;
use App\Models\SupplierDocument;
use App\Models\SupplierProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Compte fournisseur en attente de validation (SCRUM-27) : état du dossier,
 * renvoi de documents après un refus, blocage des pages de vente.
 */
class SupplierValidationStatusTest extends TestCase
{
    use RefreshDatabase;

    /** Route de vente fictive : aucune route produits / devis n'existe encore (F07, F13). */
    private const SALES_URL = '/api/supplier/test-vente';

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');

        Route::middleware(['api', 'auth:sanctum', 'verified', 'role:supplier', 'supplier.validated'])
            ->get(self::SALES_URL, fn () => ['ok' => true]);
    }

    private function actingAsSupplier(SupplierProfile $profile): SupplierProfile
    {
        Sanctum::actingAs($profile->user);

        return $profile;
    }

    private function sendDocument(string $type = SupplierDocument::TYPE_COMMERCIAL_REGISTER, ?UploadedFile $file = null)
    {
        return $this->post('/api/supplier/documents', [
            'type' => $type,
            'file' => $file ?? UploadedFile::fake()->create('registre.pdf', 300, 'application/pdf'),
        ], ['Accept' => 'application/json']);
    }

    // --- État du dossier ---------------------------------------------------------

    public function test_un_fournisseur_en_attente_voit_son_dossier_en_cours_d_examen(): void
    {
        $this->actingAsSupplier(SupplierProfile::factory()->pending()->create());

        $this->getJson('/api/supplier/validation-status')
            ->assertOk()
            ->assertJsonPath('status', 'en attente')
            ->assertJsonPath('rejection_reason', null)
            ->assertJsonPath('is_published', false)
            ->assertJsonPath('steps.reviewed_at', null)
            ->assertJsonStructure([
                'status',
                'rejection_reason',
                'steps' => ['account_created_at', 'email_verified_at', 'reviewed_at'],
                'is_published',
                'documents',
            ])
            ->assertJson(fn ($json) => $json
                ->whereType('steps.account_created_at', 'string')
                ->whereType('steps.email_verified_at', 'string')
                ->etc());
    }

    public function test_un_fournisseur_refuse_voit_le_motif_et_ses_documents(): void
    {
        $profile = $this->actingAsSupplier(SupplierProfile::factory()->rejected()->create([
            'rejection_reason' => 'Le registre de commerce a expiré.',
        ]));
        $profile->documents()->create([
            'type' => SupplierDocument::TYPE_COMMERCIAL_REGISTER,
            'file_path' => 'supplier-documents/1/registre.pdf',
            'status' => ValidationStatus::REJECTED,
            'submitted_at' => now(),
        ]);

        $this->getJson('/api/supplier/validation-status')
            ->assertOk()
            ->assertJsonPath('status', 'refusé')
            ->assertJsonPath('rejection_reason', 'Le registre de commerce a expiré.')
            ->assertJsonPath('documents.0.type', SupplierDocument::TYPE_COMMERCIAL_REGISTER)
            ->assertJsonPath('documents.0.status', 'refusé')
            ->assertJson(fn ($json) => $json->whereType('steps.reviewed_at', 'string')->etc());
    }

    public function test_un_porteur_de_projet_recoit_403(): void
    {
        Sanctum::actingAs(User::factory()->buyer()->create());

        $this->getJson('/api/supplier/validation-status')->assertForbidden();
    }

    public function test_un_invite_recoit_401(): void
    {
        $this->getJson('/api/supplier/validation-status')->assertUnauthorized();
    }

    // --- Renvoi de documents après un refus ---------------------------------------

    public function test_un_document_envoye_apres_un_refus_repasse_le_dossier_en_attente(): void
    {
        $profile = $this->actingAsSupplier(SupplierProfile::factory()->rejected()->create());

        $this->sendDocument()
            ->assertCreated()
            ->assertJsonPath('validation_status', 'en attente')
            ->assertJsonPath('document.status', 'en attente');

        $profile->refresh();
        $this->assertSame(ValidationStatus::PENDING, $profile->validation_status);
        $this->assertNull($profile->rejection_reason);
        $this->assertNull($profile->validated_at);

        $this->getJson('/api/supplier/validation-status')
            ->assertJsonPath('status', 'en attente')
            ->assertJsonPath('rejection_reason', null);
    }

    public function test_un_document_envoye_par_un_fournisseur_en_attente_le_laisse_en_attente(): void
    {
        $profile = $this->actingAsSupplier(SupplierProfile::factory()->pending()->create());

        $this->sendDocument(SupplierDocument::TYPE_CERTIFICATION)
            ->assertCreated()
            ->assertJsonPath('validation_status', 'en attente');

        $this->assertSame(ValidationStatus::PENDING, $profile->refresh()->validation_status);
    }

    public function test_un_document_envoye_par_un_fournisseur_valide_ne_change_pas_son_statut(): void
    {
        $profile = $this->actingAsSupplier(SupplierProfile::factory()->validated()->create());

        $this->sendDocument(SupplierDocument::TYPE_CERTIFICATION)->assertCreated();

        $this->assertSame(ValidationStatus::VALIDATED, $profile->refresh()->validation_status);
    }

    public function test_un_fichier_invalide_renvoie_422_et_le_dossier_reste_refuse(): void
    {
        $profile = $this->actingAsSupplier(SupplierProfile::factory()->rejected()->create());

        $this->sendDocument(file: UploadedFile::fake()->create('virus.exe', 10, 'application/octet-stream'))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['file']);

        $profile->refresh();
        $this->assertSame(ValidationStatus::REJECTED, $profile->validation_status);
        $this->assertSame('Registre de commerce illisible.', $profile->rejection_reason);
        $this->assertSame(0, $profile->documents()->count());
    }

    // --- Blocage des pages de vente -----------------------------------------------

    public function test_un_fournisseur_en_attente_ne_peut_pas_ouvrir_une_page_de_vente(): void
    {
        $this->actingAsSupplier(SupplierProfile::factory()->pending()->create());

        $this->getJson(self::SALES_URL)
            ->assertForbidden()
            ->assertJsonPath('reason', 'supplier_not_validated');
    }

    public function test_un_fournisseur_refuse_ne_peut_pas_ouvrir_une_page_de_vente(): void
    {
        $this->actingAsSupplier(SupplierProfile::factory()->rejected()->create());

        $this->getJson(self::SALES_URL)
            ->assertForbidden()
            ->assertJsonPath('reason', 'supplier_not_validated');
    }

    public function test_un_fournisseur_valide_accede_aux_pages_de_vente(): void
    {
        $this->actingAsSupplier(SupplierProfile::factory()->validated()->create());

        $this->getJson(self::SALES_URL)->assertOk()->assertJsonPath('ok', true);
    }

    public function test_un_fournisseur_en_attente_garde_acces_a_son_profil_et_a_son_statut(): void
    {
        $this->actingAsSupplier(SupplierProfile::factory()->pending()->create());

        $this->getJson('/api/supplier/profile')->assertOk();
        $this->getJson('/api/supplier/validation-status')->assertOk();
    }
}
