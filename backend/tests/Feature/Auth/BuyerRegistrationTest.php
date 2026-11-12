<?php

namespace Tests\Feature\Auth;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\Region;
use App\Models\User;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class BuyerRegistrationTest extends TestCase
{
    use RefreshDatabase;

    private Region $tunis;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tunis = Region::create(['name' => 'Tunis']);
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'first_name' => 'Karim',
            'last_name' => 'Ben Salah',
            'email' => 'karim@exemple.tn',
            'phone' => '+216 71 000 000',
            'password' => 'Password123',
            'password_confirmation' => 'Password123',
            'buyer_type' => 'entreprise',
            'organization' => 'Société Karim & Fils',
            'sector' => 'Bâtiment',
            'region_id' => $this->tunis->id,
            'terms_accepted' => true,
        ], $overrides);
    }

    public function test_un_porteur_peut_creer_son_compte_et_son_profil(): void
    {
        Notification::fake();

        $this->postJson('/api/auth/register/buyer', $this->payload())
            ->assertCreated()
            ->assertJsonPath('user.role', UserRole::Buyer->value)
            ->assertJsonPath('user.status', UserStatus::EMAIL_TO_VERIFY->value);

        $user = User::where('email', 'karim@exemple.tn')->firstOrFail();

        $this->assertSame(UserRole::Buyer, $user->role);
        $this->assertSame(UserStatus::EMAIL_TO_VERIFY, $user->status);
        $this->assertSame('Karim', $user->first_name);
        $this->assertSame('Ben Salah', $user->last_name);
        $this->assertSame('Karim Ben Salah', $user->name);
        $this->assertSame('+216 71000000', $user->phone);
        $this->assertNull($user->email_verified_at);

        $profile = $user->buyerProfile;
        $this->assertSame('entreprise', $profile->buyer_type);
        $this->assertSame('Société Karim & Fils', $profile->organization);
        $this->assertSame('Bâtiment', $profile->sector);
        $this->assertSame($this->tunis->id, $profile->region_id);
        $this->assertNotNull($profile->terms_accepted_at);

        Notification::assertSentTo($user, VerifyEmail::class);
    }

    public function test_l_e_mail_est_normalise_en_minuscules(): void
    {
        Notification::fake();

        $this->postJson('/api/auth/register/buyer', $this->payload(['email' => '  Karim@Exemple.TN ']))
            ->assertCreated();

        $this->assertDatabaseHas('users', ['email' => 'karim@exemple.tn']);
    }

    public function test_une_adresse_deja_utilisee_est_refusee(): void
    {
        User::factory()->create(['email' => 'karim@exemple.tn']);

        $this->postJson('/api/auth/register/buyer', $this->payload())
            ->assertStatus(422)
            ->assertJsonValidationErrors('email')
            ->assertJsonPath('errors.email.0', 'Un compte existe déjà avec cette adresse e-mail.');
    }

    public function test_un_mot_de_passe_trop_faible_est_refuse(): void
    {
        $this->postJson('/api/auth/register/buyer', $this->payload([
            'password' => 'password',
            'password_confirmation' => 'password',
        ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['password']);
    }

    public function test_le_telephone_doit_contenir_huit_chiffres(): void
    {
        $this->postJson('/api/auth/register/buyer', $this->payload(['phone' => '12345']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('phone');
    }

    public function test_les_champs_obligatoires_sont_verifies(): void
    {
        $this->postJson('/api/auth/register/buyer', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors([
                'first_name',
                'last_name',
                'email',
                'phone',
                'password',
                'buyer_type',
                'organization',
                'sector',
                'region_id',
                'terms_accepted',
            ])
            ->assertJsonPath('errors.organization.0', "L'organisation ou le projet représenté est obligatoire.");
    }

    public function test_aucun_profil_n_est_cree_si_la_validation_echoue(): void
    {
        $this->postJson('/api/auth/register/buyer', $this->payload(['organization' => '']))
            ->assertStatus(422);

        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseCount('buyer_profiles', 0);
    }
}
