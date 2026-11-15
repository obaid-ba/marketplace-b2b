<?php

namespace Tests\Feature\Supplier;

use App\Enums\SupplierSector;
use App\Enums\ValidationStatus;
use App\Models\Category;
use App\Models\Region;
use App\Models\SupplierDocument;
use App\Models\SupplierProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Profil de l'entreprise (SCRUM-28).
 */
class SupplierProfileTest extends TestCase
{
    use RefreshDatabase;

    private Region $tunis;

    private Region $sfax;

    private Category $emballage;

    private Category $logistique;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');
        Storage::fake('local');

        $this->tunis = Region::create(['name' => 'Tunis']);
        $this->sfax = Region::create(['name' => 'Sfax']);
        $this->emballage = Category::create(['name' => 'Emballage', 'position' => 1]);
        $this->logistique = Category::create(['name' => 'Logistique', 'position' => 2]);
    }

    private function actingAsSupplier(?SupplierProfile $profile = null): SupplierProfile
    {
        $profile ??= SupplierProfile::factory()->create(['region_id' => $this->tunis->id]);
        Sanctum::actingAs($profile->user);

        return $profile;
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'company_name' => 'Atlas Emballages',
            'description' => 'Spécialiste des emballages en carton ondulé depuis 2009.',
            'sector' => SupplierSector::PACKAGING->value,
            'region_id' => $this->sfax->id,
            'professional_phone' => '74 000 000',
            'professional_email' => 'Contact@Atlas-Emballages.tn',
            'categories' => [$this->emballage->id, $this->logistique->id],
            'coverage_regions' => [$this->sfax->id, $this->tunis->id],
        ], $overrides);
    }

    public function test_un_fournisseur_consulte_son_profil(): void
    {
        $profile = $this->actingAsSupplier();
        $profile->categories()->sync([$this->emballage->id]);
        $profile->coverageRegions()->sync([$this->tunis->id]);
        $profile->documents()->create([
            'type' => SupplierDocument::TYPE_COMMERCIAL_REGISTER,
            'file_path' => 'supplier-documents/1/registre.pdf',
            'status' => ValidationStatus::VALIDATED,
            'submitted_at' => now(),
        ]);

        $this->getJson('/api/supplier/profile')
            ->assertOk()
            ->assertJsonPath('id', $profile->id)
            ->assertJsonPath('company_name', $profile->company_name)
            ->assertJsonPath('validation_status', 'en attente')
            ->assertJsonPath('can_publish', false)
            ->assertJsonPath('categories.0.name', 'Emballage')
            ->assertJsonPath('coverage_regions.0.name', 'Tunis')
            ->assertJsonPath('documents.0.file_name', 'Registre de commerce.pdf')
            ->assertJsonPath('documents.0.status', 'validé')
            ->assertJsonStructure(['logo_url', 'rating_avg', 'reviews_count', 'region' => ['id', 'name']]);
    }

    public function test_un_fournisseur_met_a_jour_son_profil_et_synchronise_categories_et_zones(): void
    {
        $profile = $this->actingAsSupplier();
        $profile->categories()->sync([$this->logistique->id]);

        $this->putJson('/api/supplier/profile', $this->payload([
            'categories' => [$this->emballage->id],
            'coverage_regions' => [$this->sfax->id],
        ]))
            ->assertOk()
            ->assertJsonPath('profile.company_name', 'Atlas Emballages')
            ->assertJsonPath('profile.professional_phone', '+216 74000000')
            ->assertJsonPath('profile.professional_email', 'contact@atlas-emballages.tn')
            ->assertJsonPath('profile.region.name', 'Sfax');

        $profile->refresh();
        $this->assertSame('Atlas Emballages', $profile->company_name);
        $this->assertSame([$this->emballage->id], $profile->categories()->pluck('categories.id')->all());
        $this->assertSame([$this->sfax->id], $profile->coverageRegions()->pluck('regions.id')->all());
    }

    public function test_les_champs_proteges_envoyes_dans_la_requete_sont_ignores(): void
    {
        $profile = $this->actingAsSupplier();
        $other = User::factory()->supplier()->create();

        $this->putJson('/api/supplier/profile', $this->payload([
            'validation_status' => ValidationStatus::VALIDATED->value,
            'is_published' => true,
            'rating_avg' => 5,
            'reviews_count' => 999,
            'user_id' => $other->id,
        ]))->assertOk();

        $profile->refresh();
        $this->assertSame(ValidationStatus::PENDING, $profile->validation_status);
        $this->assertFalse($profile->is_published);
        $this->assertSame(0, (int) $profile->reviews_count);
        $this->assertSame($profile->user->id, $profile->user_id);
        $this->assertNotSame($other->id, $profile->user_id);
    }

    public function test_les_donnees_invalides_renvoient_422_avec_les_bonnes_cles(): void
    {
        $this->actingAsSupplier();

        $this->putJson('/api/supplier/profile', [
            'company_name' => '',
            'sector' => 'Secteur inventé',
            'region_id' => 9999,
            'professional_phone' => '123',
            'professional_email' => 'pas-un-email',
            'categories' => [],
            'coverage_regions' => [9999],
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'company_name',
                'sector',
                'region_id',
                'professional_phone',
                'professional_email',
                'categories',
                'coverage_regions.0',
            ]);
    }

    public function test_un_secteur_saisi_avant_la_liste_fixe_reste_accepte(): void
    {
        $this->actingAsSupplier(SupplierProfile::factory()->create(['sector' => 'Construction']));

        $this->putJson('/api/supplier/profile', $this->payload(['sector' => 'Construction']))
            ->assertOk()
            ->assertJsonPath('profile.sector', 'Construction');
    }

    public function test_un_porteur_de_projet_ne_peut_pas_acceder_au_profil_fournisseur(): void
    {
        Sanctum::actingAs(User::factory()->buyer()->create());

        $this->getJson('/api/supplier/profile')->assertForbidden();
        $this->putJson('/api/supplier/profile', $this->payload())->assertForbidden();
    }

    public function test_un_invite_recoit_401(): void
    {
        $this->getJson('/api/supplier/profile')->assertUnauthorized();
        $this->putJson('/api/supplier/profile', $this->payload())->assertUnauthorized();
    }

    public function test_un_fournisseur_sans_profil_recoit_404(): void
    {
        Sanctum::actingAs(User::factory()->supplier()->create());

        $this->getJson('/api/supplier/profile')->assertNotFound();
    }

    public function test_un_fournisseur_en_attente_ne_peut_pas_publier(): void
    {
        $profile = $this->actingAsSupplier(SupplierProfile::factory()->pending()->create());

        $this->patchJson('/api/supplier/profile/publish', ['is_published' => true])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['is_published']);

        $this->assertFalse($profile->refresh()->is_published);
    }

    public function test_un_fournisseur_refuse_ne_peut_pas_publier(): void
    {
        $this->actingAsSupplier(SupplierProfile::factory()->rejected()->create());

        $this->patchJson('/api/supplier/profile/publish', ['is_published' => true])
            ->assertUnprocessable();
    }

    public function test_un_fournisseur_valide_peut_publier_puis_depublier(): void
    {
        $profile = $this->actingAsSupplier(SupplierProfile::factory()->validated()->create());

        $this->patchJson('/api/supplier/profile/publish', ['is_published' => true])
            ->assertOk()
            ->assertJsonPath('profile.is_published', true)
            ->assertJsonPath('profile.can_publish', true);
        $this->assertTrue($profile->refresh()->is_published);

        $this->patchJson('/api/supplier/profile/publish', ['is_published' => false])
            ->assertOk()
            ->assertJsonPath('profile.is_published', false);
        $this->assertFalse($profile->refresh()->is_published);
    }

    public function test_un_fournisseur_change_son_logo(): void
    {
        $profile = $this->actingAsSupplier();
        $old = UploadedFile::fake()->image('ancien.png')->store('supplier-logos', 'public');
        $profile->forceFill(['logo' => $old])->save();

        $response = $this->post('/api/supplier/profile/logo', [
            'logo' => UploadedFile::fake()->image('logo.png', 200, 200),
        ], ['Accept' => 'application/json'])->assertOk();

        $profile->refresh();
        $this->assertNotSame($old, $profile->logo);
        Storage::disk('public')->assertExists($profile->logo);
        Storage::disk('public')->assertMissing($old);
        $this->assertNotNull($response->json('profile.logo_url'));
    }

    public function test_un_logo_qui_n_est_pas_une_image_est_refuse(): void
    {
        $this->actingAsSupplier();

        $this->post('/api/supplier/profile/logo', [
            'logo' => UploadedFile::fake()->create('logo.pdf', 100, 'application/pdf'),
        ], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['logo']);
    }

    public function test_un_document_ajoute_est_en_attente_et_stocke_en_prive(): void
    {
        $profile = $this->actingAsSupplier(SupplierProfile::factory()->validated()->create());

        $this->post('/api/supplier/documents', [
            'type' => SupplierDocument::TYPE_CERTIFICATION,
            'file' => UploadedFile::fake()->create('iso-9001.pdf', 200, 'application/pdf'),
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('document.status', 'en attente')
            ->assertJsonPath('document.file_name', 'Certification.pdf');

        $document = $profile->documents()->sole();
        $this->assertSame(ValidationStatus::PENDING, $document->status);
        Storage::disk('local')->assertExists($document->file_path);
        Storage::disk('public')->assertMissing($document->file_path);
    }

    public function test_un_document_au_mauvais_format_est_refuse(): void
    {
        $this->actingAsSupplier();

        $this->post('/api/supplier/documents', [
            'type' => SupplierDocument::TYPE_CERTIFICATION,
            'file' => UploadedFile::fake()->create('virus.exe', 10, 'application/octet-stream'),
        ], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['file']);

        $this->post('/api/supplier/documents', [
            'type' => 'type inconnu',
            'file' => UploadedFile::fake()->create('doc.pdf', 10, 'application/pdf'),
        ], ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['type']);
    }

    public function test_seul_le_proprietaire_telecharge_un_document(): void
    {
        $owner = SupplierProfile::factory()->create();
        Storage::disk('local')->put('supplier-documents/x/registre.pdf', 'contenu');
        $document = $owner->documents()->create([
            'type' => SupplierDocument::TYPE_COMMERCIAL_REGISTER,
            'file_path' => 'supplier-documents/x/registre.pdf',
            'status' => ValidationStatus::PENDING,
            'submitted_at' => now(),
        ]);

        $this->actingAsSupplier();
        $this->get("/api/supplier/documents/{$document->id}/download", ['Accept' => 'application/json'])
            ->assertForbidden();

        Sanctum::actingAs($owner->user);
        $this->get("/api/supplier/documents/{$document->id}/download")
            ->assertOk()
            ->assertDownload('Registre de commerce.pdf');
    }

    public function test_la_liste_des_secteurs_est_disponible(): void
    {
        $this->getJson('/api/reference/sectors')
            ->assertOk()
            ->assertJsonFragment([SupplierSector::PACKAGING->value]);
    }

    public function test_auth_me_renvoie_le_nom_de_l_entreprise_du_fournisseur(): void
    {
        $profile = $this->actingAsSupplier();

        $this->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('supplier_company_name', $profile->company_name);
    }
}
