<?php

namespace Tests\Feature\Auth;

use App\Enums\UserStatus;
use App\Enums\ValidationStatus;
use App\Models\Category;
use App\Models\Region;
use App\Models\SupplierDocument;
use App\Models\User;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class SupplierRegistrationTest extends TestCase
{
    use RefreshDatabase;

    private Region $tunis;

    private Region $sfax;

    private Category $btp;

    private Category $informatique;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tunis = Region::create(['name' => 'Tunis']);
        $this->sfax = Region::create(['name' => 'Sfax']);

        $this->btp = Category::create(['name' => 'BTP et matériaux', 'position' => 1]);
        $this->informatique = Category::create(['name' => 'Informatique', 'position' => 2]);
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'first_name' => 'Amina',
            'last_name' => 'Trabelsi',
            'email' => 'amina@exemple.tn',
            'password' => 'Password123',
            'password_confirmation' => 'Password123',
            'phone' => '+216 71 000 000',
            'company_name' => 'Amina Bâtiment SARL',
            'legal_form' => 'SARL',
            'tax_id' => '1234567A',
            'rne_number' => 'RNE-2026-001',
            'sector' => 'Construction',
            'description' => 'Entreprise générale de bâtiment.',
            'region_id' => $this->tunis->id,
            'address' => '12 rue du marché',
            'city' => 'Tunis',
            'contact_name' => 'Amina Trabelsi',
            'contact_role' => 'Gérante',
            'contact_phone' => '+216 71 000 001',
            'coverage_regions' => [$this->tunis->id, $this->sfax->id],
            'categories' => [$this->btp->id, $this->informatique->id],
            'contact' => 'contact@amina.tn',
            'commercial_register' => UploadedFile::fake()->create('registre.pdf', 120, 'application/pdf'),
            'tax_certificate' => UploadedFile::fake()->create('attestation.pdf', 120, 'application/pdf'),
            'manager_id' => UploadedFile::fake()->create('cin.pdf', 120, 'application/pdf'),
            'certifications' => [
                UploadedFile::fake()->create('certification.pdf', 80, 'application/pdf'),
            ],
        ], $overrides);
    }

    public function test_un_fournisseur_peut_creer_son_compte_avec_ses_justificatifs(): void
    {
        Notification::fake();
        Storage::fake('local');

        $response = $this->post('/api/auth/register/supplier', $this->payload());

        $response->assertCreated()
            ->assertJsonPath('user.role', 'supplier')
            ->assertJsonPath('user.status', UserStatus::EMAIL_TO_VERIFY->value)
            ->assertJsonPath('profile.validation_status', ValidationStatus::PENDING->value)
            ->assertJsonPath('profile.company_name', 'Amina Bâtiment SARL');

        $user = User::where('email', 'amina@exemple.tn')->firstOrFail();

        $this->assertSame(UserStatus::EMAIL_TO_VERIFY, $user->status);
        $this->assertSame('Amina', $user->first_name);
        $this->assertSame('Trabelsi', $user->last_name);
        $this->assertSame('Amina Trabelsi', $user->name);
        $this->assertSame('+216 71000000', $user->phone);
        $this->assertNull($user->email_verified_at);
        $this->assertTrue(Hash::check('Password123', $user->password));

        $profile = $user->supplierProfile;
        $this->assertNotNull($profile);
        $this->assertSame('Amina Bâtiment SARL', $profile->company_name);
        $this->assertSame('SARL', $profile->legal_form);
        $this->assertSame('1234567A', $profile->tax_id);
        $this->assertSame('RNE-2026-001', $profile->rne_number);
        $this->assertSame('12 rue du marché', $profile->address);
        $this->assertSame('Tunis', $profile->city);
        $this->assertSame('Amina Trabelsi', $profile->contact_name);
        $this->assertSame(ValidationStatus::PENDING, $profile->validation_status);
        $this->assertFalse($profile->is_published);

        $this->assertEqualsCanonicalizing(
            [$this->tunis->id, $this->sfax->id],
            $profile->coverageRegions->pluck('id')->all()
        );
        $this->assertEqualsCanonicalizing(
            [$this->btp->id, $this->informatique->id],
            $profile->categories->pluck('id')->all()
        );

        $documents = $profile->documents;
        $this->assertCount(4, $documents);
        $this->assertSame([
            SupplierDocument::TYPE_COMMERCIAL_REGISTER,
            SupplierDocument::TYPE_TAX_CERTIFICATE,
            SupplierDocument::TYPE_MANAGER_ID,
            SupplierDocument::TYPE_CERTIFICATION,
        ], $documents->pluck('type')->all());
        $this->assertTrue($documents->every(
            fn (SupplierDocument $document) => $document->status === ValidationStatus::PENDING
        ));

        foreach ($documents as $document) {
            Storage::disk('local')->assertExists($document->file_path);
        }

        Notification::assertSentTo($user, VerifyEmail::class);
    }

    public function test_une_adresse_e_mail_deja_utilisee_est_refusee(): void
    {
        User::factory()->create(['email' => 'amina@exemple.tn']);

        $this->post('/api/auth/register/supplier', $this->payload())
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    public function test_un_mot_de_passe_trop_faible_est_refuse(): void
    {
        $this->post('/api/auth/register/supplier', $this->payload([
            'password' => 'password',
            'password_confirmation' => 'password',
        ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('password');
    }

    public function test_les_regions_et_categories_doivent_exister(): void
    {
        $this->post('/api/auth/register/supplier', $this->payload([
            'region_id' => 999,
            'coverage_regions' => [999],
            'categories' => [999],
        ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['region_id', 'coverage_regions.0', 'categories.0']);
    }

    public function test_les_justificatifs_sont_obligatoires_et_doivent_etre_des_pdf_ou_des_images(): void
    {
        Storage::fake('local');

        $this->post('/api/auth/register/supplier', $this->payload([
            'commercial_register' => null,
            'tax_certificate' => null,
            'manager_id' => null,
        ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['commercial_register', 'tax_certificate', 'manager_id']);

        $this->post('/api/auth/register/supplier', $this->payload([
            'commercial_register' => UploadedFile::fake()->create('registre.exe', 10, 'application/octet-stream'),
        ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('commercial_register');

        // Les certifications restent optionnelles.
        $this->post('/api/auth/register/supplier', $this->payload([
            'certifications' => null,
        ]))->assertCreated();
    }

    public function test_la_disponibilite_d_une_adresse_e_mail_peut_etre_verifiee(): void
    {
        $this->postJson('/api/auth/register/supplier/check-email', ['email' => 'libre@exemple.tn'])
            ->assertOk()
            ->assertJsonPath('available', true);

        $existing = User::factory()->create(['email' => 'pris@exemple.tn']);

        $this->postJson('/api/auth/register/supplier/check-email', ['email' => 'PRIS@exemple.tn'])
            ->assertOk()
            ->assertJsonPath('available', false);

        $existing->delete();

        // Un compte supprimé (soft delete) garde son e-mail unique en base.
        $this->postJson('/api/auth/register/supplier/check-email', ['email' => 'pris@exemple.tn'])
            ->assertOk()
            ->assertJsonPath('available', false);
    }

    public function test_les_regions_et_categories_sont_exposees_aux_formulaires(): void
    {
        $this->getJson('/api/reference/regions')
            ->assertOk()
            ->assertJsonCount(2)
            ->assertJsonFragment(['name' => 'Tunis']);

        $this->getJson('/api/reference/categories')
            ->assertOk()
            ->assertJsonCount(2)
            ->assertJsonFragment(['name' => 'Informatique']);
    }
}
