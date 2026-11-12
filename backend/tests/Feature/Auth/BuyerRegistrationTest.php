<?php

namespace Tests\Feature\Auth;

use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class BuyerRegistrationTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array<string, string>
     */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Karim Ben Salah',
            'email' => 'karim@exemple.tn',
            'password' => 'Password123',
            'password_confirmation' => 'Password123',
            'organization' => 'Société Karim & Fils',
            'sector' => 'Bâtiment',
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
        $this->assertNull($user->email_verified_at);
        $this->assertSame('Société Karim & Fils', $user->buyerProfile->organization);
        $this->assertSame('Bâtiment', $user->buyerProfile->sector);

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

    public function test_les_champs_obligatoires_sont_verifies(): void
    {
        $this->postJson('/api/auth/register/buyer', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['name', 'email', 'password', 'organization', 'sector'])
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
