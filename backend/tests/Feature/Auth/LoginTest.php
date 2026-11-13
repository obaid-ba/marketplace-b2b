<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\TestCase;

class LoginTest extends TestCase
{
    use RefreshDatabase;

    public function test_un_utilisateur_actif_peut_se_connecter_et_recoit_un_jeton(): void
    {
        $user = User::factory()->supplier()->create(['email' => 'f@test.tn']);

        $response = $this->postJson('/api/auth/login', [
            'email' => 'F@test.tn',
            'password' => 'password',
        ]);

        $response->assertOk()
            ->assertJsonStructure(['token', 'user' => ['id', 'email', 'role']])
            ->assertJsonPath('user.role', 'supplier');

        $this->assertNotNull($user->fresh()->last_login_at);
    }

    public function test_des_identifiants_incorrects_sont_refuses(): void
    {
        User::factory()->create(['email' => 'p@test.tn']);

        $this->postJson('/api/auth/login', ['email' => 'p@test.tn', 'password' => 'mauvais'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    public function test_un_compte_suspendu_ne_peut_pas_se_connecter(): void
    {
        User::factory()->suspended()->create(['email' => 's@test.tn']);

        $this->postJson('/api/auth/login', ['email' => 's@test.tn', 'password' => 'password'])
            ->assertForbidden();
    }

    public function test_me_renvoie_l_utilisateur_connecte(): void
    {
        $user = User::factory()->buyer()->create();
        $token = $user->createToken('test')->plainTextToken;

        $this->withToken($token)->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('id', $user->id)
            ->assertJsonPath('role', 'buyer');
    }

    public function test_me_sans_jeton_renvoie_401(): void
    {
        $this->getJson('/api/auth/me')->assertUnauthorized();
    }

    public function test_la_deconnexion_revoque_le_jeton(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('test')->plainTextToken;

        $this->withToken($token)->postJson('/api/auth/logout')->assertOk();

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    // --- SCRUM-25 : se connecter et arriver sur son tableau de bord ---

    public function test_le_message_d_erreur_ne_revele_pas_si_le_compte_existe(): void
    {
        User::factory()->create(['email' => 'p@test.tn']);

        $wrongPassword = $this->postJson('/api/auth/login', ['email' => 'p@test.tn', 'password' => 'mauvais']);
        $unknownEmail = $this->postJson('/api/auth/login', ['email' => 'inconnu@test.tn', 'password' => 'mauvais']);

        $wrongPassword->assertStatus(422)->assertJsonPath('errors.email.0', 'Adresse e-mail ou mot de passe incorrect.');
        $unknownEmail->assertStatus(422)->assertJsonPath('errors.email.0', 'Adresse e-mail ou mot de passe incorrect.');
    }

    public function test_les_tentatives_de_connexion_sont_limitees(): void
    {
        User::factory()->create(['email' => 'p@test.tn']);

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/login', ['email' => 'p@test.tn', 'password' => 'mauvais'])->assertStatus(422);
        }

        // Même le bon mot de passe est refusé tant que la limite est atteinte.
        $this->postJson('/api/auth/login', ['email' => 'p@test.tn', 'password' => 'password'])->assertTooManyRequests();
    }

    public function test_un_compte_suspendu_ou_desactive_recoit_un_message_explicite(): void
    {
        User::factory()->suspended()->create(['email' => 's@test.tn']);
        User::factory()->deactivated()->create(['email' => 'd@test.tn']);

        $this->postJson('/api/auth/login', ['email' => 's@test.tn', 'password' => 'password'])
            ->assertForbidden()
            ->assertJsonPath('reason', 'suspended')
            ->assertJsonPath('message', "Votre compte a été suspendu. Contactez l'administrateur de la plateforme pour en savoir plus.");

        $this->postJson('/api/auth/login', ['email' => 'd@test.tn', 'password' => 'password'])
            ->assertForbidden()
            ->assertJsonPath('reason', 'deactivated');

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_sans_se_souvenir_de_moi_la_session_est_courte(): void
    {
        User::factory()->create(['email' => 'p@test.tn']);

        $this->postJson('/api/auth/login', ['email' => 'p@test.tn', 'password' => 'password'])->assertOk();

        $expiresAt = PersonalAccessToken::sole()->expires_at;
        $this->assertTrue($expiresAt->between(now()->addHours(11), now()->addHours(13)));
    }

    public function test_se_souvenir_de_moi_prolonge_la_session(): void
    {
        User::factory()->create(['email' => 'p@test.tn']);

        $this->postJson('/api/auth/login', ['email' => 'p@test.tn', 'password' => 'password', 'remember' => true])
            ->assertOk();

        $expiresAt = PersonalAccessToken::sole()->expires_at;
        $this->assertTrue($expiresAt->between(now()->addDays(6), now()->addDays(8)));
    }

    public function test_un_jeton_expire_ne_donne_plus_acces(): void
    {
        User::factory()->create(['email' => 'p@test.tn']);
        $token = $this->postJson('/api/auth/login', ['email' => 'p@test.tn', 'password' => 'password'])->json('token');

        $this->travel(13)->hours();

        $this->withToken($token)->getJson('/api/auth/me')->assertUnauthorized();
    }

    public function test_la_connexion_renvoie_le_role_pour_la_redirection(): void
    {
        User::factory()->admin()->create(['email' => 'a@test.tn']);

        $this->postJson('/api/auth/login', ['email' => 'a@test.tn', 'password' => 'password'])
            ->assertOk()
            ->assertJsonPath('user.role', 'admin')
            ->assertJsonPath('user.email_verified', true);
    }
}
