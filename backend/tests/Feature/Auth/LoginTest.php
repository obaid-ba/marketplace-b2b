<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
}
