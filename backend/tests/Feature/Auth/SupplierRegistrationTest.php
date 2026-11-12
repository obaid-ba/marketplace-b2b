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
use Illuminate\Support\Facades\URL;
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
            'email' => 'amina@exemple.tn',
            'password' => 'Password123',
            'password_confirmation' => 'Password123',
            'company_name' => 'Amina Bâtiment SARL',
            'sector' => 'Construction',
            'region_id' => $this->tunis->id,
            'coverage_regions' => [$this->tunis->id, $this->sfax->id],
            'categories' => [$this->btp->id, $this->informatique->id],
            'description' => 'Entreprise générale de bâtiment.',
            'phone' => '+216 71 000 000',
            'contact' => 'contact@amina.tn',
            'commercial_register' => UploadedFile::fake()->create('registre.pdf', 120, 'application/pdf'),
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
        $this->assertNull($user->email_verified_at);
        $this->assertTrue(Hash::check('Password123', $user->password));

        $profile = $user->supplierProfile;
        $this->assertNotNull($profile);
        $this->assertSame('Amina Bâtiment SARL', $profile->company_name);
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
        $this->assertCount(2, $documents);
        $this->assertSame(
            [SupplierDocument::TYPE_COMMERCIAL_REGISTER, SupplierDocument::TYPE_CERTIFICATION],
            $documents->pluck('type')->all()
        );
        $this->assertTrue($documents->every(
            fn (SupplierDocument $document) => $document->status === ValidationStatus::PENDING
        ));

        foreach ($documents as $document) {
            Storage::disk('local')->assertExists($document->file_path);
        }

        Notification::assertSentTo(
            $user,
            VerifyEmail::class,
            fn (VerifyEmail $notification) => str_contains(
                $notification->toMail($user)->actionUrl,
                '/api/auth/email/verify/'
            )
        );
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
        $this->post('/api/auth/register/supplier', $this->payload([
            'commercial_register' => null,
            'certifications' => null,
        ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['commercial_register', 'certifications']);

        $this->post('/api/auth/register/supplier', $this->payload([
            'commercial_register' => UploadedFile::fake()->create('registre.exe', 10, 'application/octet-stream'),
        ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('commercial_register');
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

    public function test_le_lien_de_verification_active_le_compte(): void
    {
        $user = User::factory()->supplier()->unverified()->create([
            'email' => 'nouveau@exemple.tn',
        ]);

        $url = URL::temporarySignedRoute('verification.verify', now()->addHour(), [
            'id' => $user->id,
            'hash' => sha1($user->getEmailForVerification()),
        ]);

        $this->get($url)
            ->assertRedirect(config('app.frontend_url').'/connexion?verifie=1');

        $user->refresh();
        $this->assertTrue($user->hasVerifiedEmail());
        $this->assertSame(UserStatus::ACTIVE, $user->status);
    }

    public function test_un_lien_de_verification_non_signe_est_refuse(): void
    {
        $user = User::factory()->supplier()->unverified()->create();

        $this->get("/api/auth/email/verify/{$user->id}/".sha1($user->getEmailForVerification()))
            ->assertForbidden();

        $this->assertFalse($user->fresh()->hasVerifiedEmail());
    }

    public function test_un_compte_non_verifie_ne_peut_pas_se_connecter(): void
    {
        User::factory()->supplier()->unverified()->create([
            'email' => 'en-attente@exemple.tn',
        ]);

        $this->postJson('/api/auth/login', [
            'email' => 'en-attente@exemple.tn',
            'password' => 'password',
        ])
            ->assertForbidden()
            ->assertJsonPath('message', 'Veuillez vérifier votre adresse e-mail avant de vous connecter.');
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
