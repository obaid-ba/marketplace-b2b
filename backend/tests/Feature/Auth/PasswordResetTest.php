<?php

namespace Tests\Feature\Auth;

use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/** SCRUM-26 : réinitialiser son mot de passe oublié. */
class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    private const NEW_PASSWORD = 'Nouveau2026';

    /** Demande un lien et renvoie le jeton contenu dans l'e-mail reçu. */
    private function requestToken(User $user): string
    {
        Notification::fake();
        $this->postJson('/api/auth/forgot-password', ['email' => $user->email])->assertOk();

        $token = null;
        Notification::assertSentTo($user, ResetPassword::class, function (ResetPassword $n) use (&$token) {
            $token = $n->token;

            return true;
        });

        return $token;
    }

    private function reset(string $email, string $token, string $password = self::NEW_PASSWORD, ?string $confirmation = null)
    {
        return $this->postJson('/api/auth/reset-password', [
            'email' => $email,
            'token' => $token,
            'password' => $password,
            'password_confirmation' => $confirmation ?? $password,
        ]);
    }

    public function test_la_reponse_est_la_meme_que_l_adresse_existe_ou_non(): void
    {
        Notification::fake();
        $user = User::factory()->create(['email' => 'karim@test.tn']);

        $known = $this->postJson('/api/auth/forgot-password', ['email' => 'Karim@test.tn']);
        $unknown = $this->postJson('/api/auth/forgot-password', ['email' => 'inconnu@test.tn']);

        $known->assertOk();
        $unknown->assertOk();
        $this->assertSame($known->json(), $unknown->json());

        Notification::assertSentTo($user, ResetPassword::class);
        Notification::assertCount(1);
    }

    public function test_le_lien_de_l_e_mail_ouvre_l_application_web(): void
    {
        config(['app.frontend_url' => 'https://app.marketplace.tn']);
        $user = User::factory()->create(['email' => 'karim@test.tn']);
        $token = $this->requestToken($user);

        Notification::assertSentTo($user, ResetPassword::class, function (ResetPassword $n) use ($user, $token) {
            $mail = $n->toMail($user);

            return $mail->actionUrl === 'https://app.marketplace.tn/mot-de-passe/nouveau?token='.$token.'&email=karim%40test.tn'
                && $mail->subject === 'Réinitialisation de votre mot de passe';
        });
    }

    public function test_le_nouveau_mot_de_passe_remplace_l_ancien_et_ferme_les_sessions(): void
    {
        $user = User::factory()->create();
        $user->createToken('mobile');
        $token = $this->requestToken($user);

        $this->reset($user->email, $token)->assertOk();

        $this->assertTrue(Hash::check(self::NEW_PASSWORD, $user->fresh()->password));
        $this->assertDatabaseCount('personal_access_tokens', 0);

        $this->postJson('/api/auth/login', ['email' => $user->email, 'password' => self::NEW_PASSWORD])->assertOk();
    }

    public function test_le_lien_ne_fonctionne_qu_une_fois(): void
    {
        $user = User::factory()->create();
        $token = $this->requestToken($user);

        $this->reset($user->email, $token)->assertOk();
        $this->reset($user->email, $token, 'Autre2026x')
            ->assertStatus(422)
            ->assertJsonPath('reason', 'invalid_token');

        $this->assertTrue(Hash::check(self::NEW_PASSWORD, $user->fresh()->password));
    }

    public function test_le_lien_expire(): void
    {
        $user = User::factory()->create();
        $token = $this->requestToken($user);

        $this->travel(config('auth.passwords.users.expire') + 1)->minutes();

        $this->reset($user->email, $token)->assertStatus(422)->assertJsonPath('reason', 'invalid_token');
        $this->assertTrue(Hash::check('password', $user->fresh()->password));
    }

    public function test_un_jeton_invente_ou_d_un_autre_compte_est_refuse(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $token = $this->requestToken($user);

        $this->reset($user->email, 'jeton-invente')->assertStatus(422);
        $this->reset($other->email, $token)->assertStatus(422);
    }

    public function test_le_mot_de_passe_doit_etre_confirme_et_robuste(): void
    {
        $user = User::factory()->create();
        $token = $this->requestToken($user);

        $this->reset($user->email, $token, 'Nouveau2026', 'Different2026')
            ->assertStatus(422)
            ->assertJsonPath('errors.password.0', 'Les deux mots de passe ne correspondent pas.');

        $this->reset($user->email, $token, 'motdepasse')
            ->assertStatus(422)
            ->assertJsonValidationErrors('password');

        // Le jeton n'a pas été consommé par ces tentatives refusées.
        $this->reset($user->email, $token)->assertOk();
    }

    public function test_la_reinitialisation_confirme_aussi_l_adresse_e_mail(): void
    {
        $user = User::factory()->unverified()->create();
        $token = $this->requestToken($user);

        $this->reset($user->email, $token)->assertOk();

        $user->refresh();
        $this->assertTrue($user->hasVerifiedEmail());
        $this->assertSame(UserStatus::ACTIVE, $user->status);
    }

    public function test_les_demandes_sont_limitees(): void
    {
        Notification::fake();

        for ($i = 0; $i < 3; $i++) {
            $this->postJson('/api/auth/forgot-password', ['email' => "x{$i}@test.tn"])->assertOk();
        }

        $this->postJson('/api/auth/forgot-password', ['email' => 'y@test.tn'])->assertTooManyRequests();
    }
}
