<?php

namespace Tests\Feature\Auth;

use App\Enums\UserStatus;
use App\Models\SupplierProfile;
use App\Models\User;
use Illuminate\Auth\Events\Verified;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/** SCRUM-24 : vérifier son adresse e-mail. */
class EmailVerificationTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Envoie l'e-mail de vérification et renvoie l'adresse API que la page React appellera
     * à partir du lien reçu (/email/verifier?id=…&hash=…&expires=…&signature=…).
     */
    private function apiUrlFromEmail(User $user): string
    {
        Notification::fake();
        $user->sendEmailVerificationNotification();

        $link = null;
        Notification::assertSentTo($user, VerifyEmail::class, function (VerifyEmail $notification) use ($user, &$link) {
            $link = $notification->toMail($user)->actionUrl;

            return true;
        });

        parse_str((string) parse_url($link, PHP_URL_QUERY), $q);

        return "/api/auth/email/verify/{$q['id']}/{$q['hash']}?expires={$q['expires']}&signature={$q['signature']}";
    }

    public function test_le_lien_de_l_e_mail_ouvre_l_application_web(): void
    {
        config(['app.frontend_url' => 'https://app.marketplace.tn']);
        $user = User::factory()->unverified()->create();

        Notification::fake();
        $user->sendEmailVerificationNotification();

        Notification::assertSentTo($user, VerifyEmail::class, function (VerifyEmail $notification) use ($user) {
            $mail = $notification->toMail($user);

            return str_starts_with($mail->actionUrl, 'https://app.marketplace.tn/email/verifier?id='.$user->id)
                && str_contains($mail->actionUrl, '&signature=')
                && $mail->subject === 'Confirmez votre adresse e-mail';
        });
    }

    public function test_un_lien_valide_verifie_l_adresse_et_active_le_compte(): void
    {
        Event::fake([Verified::class]);
        $user = User::factory()->buyer()->unverified()->create();

        $this->getJson($this->apiUrlFromEmail($user))
            ->assertOk()
            ->assertJsonPath('user.email_verified', true)
            ->assertJsonPath('user.role', 'buyer')
            ->assertJsonPath('user.status', UserStatus::ACTIVE->value);

        $user->refresh();
        $this->assertTrue($user->hasVerifiedEmail());
        $this->assertSame(UserStatus::ACTIVE, $user->status);
        Event::assertDispatched(Verified::class);
    }

    public function test_un_fournisseur_verifie_reste_en_attente_de_validation(): void
    {
        $user = User::factory()->supplier()->unverified()->create();
        SupplierProfile::create(['user_id' => $user->id, 'company_name' => 'Atlas SARL']);

        $this->getJson($this->apiUrlFromEmail($user))
            ->assertOk()
            ->assertJsonPath('user.role', 'supplier')
            ->assertJsonPath('user.supplier_validation_status', 'en attente');
    }

    public function test_le_lien_ne_fonctionne_qu_une_fois(): void
    {
        $user = User::factory()->unverified()->create();
        $url = $this->apiUrlFromEmail($user);

        $this->getJson($url)->assertOk();
        $this->getJson($url)
            ->assertStatus(409)
            ->assertJsonPath('reason', 'already_verified');
    }

    public function test_un_lien_expire_est_refuse(): void
    {
        $user = User::factory()->unverified()->create();
        $url = $this->apiUrlFromEmail($user);

        $this->travel(config('auth.verification.expire') + 1)->minutes();

        $this->getJson($url)
            ->assertStatus(410)
            ->assertJsonPath('reason', 'expired');
        $this->assertFalse($user->fresh()->hasVerifiedEmail());
    }

    public function test_un_lien_modifie_est_refuse(): void
    {
        $user = User::factory()->unverified()->create();
        $other = User::factory()->unverified()->create();
        $url = $this->apiUrlFromEmail($user);

        // Signature falsifiée
        $this->getJson(preg_replace('/signature=\w+/', 'signature=abc', $url))
            ->assertForbidden()
            ->assertJsonPath('reason', 'invalid');

        // Même lien appliqué à un autre compte
        $this->getJson(str_replace("/verify/{$user->id}/", "/verify/{$other->id}/", $url))
            ->assertForbidden();

        $this->assertFalse($user->fresh()->hasVerifiedEmail());
        $this->assertFalse($other->fresh()->hasVerifiedEmail());
    }

    public function test_renvoyer_le_lien_est_limite_dans_le_temps(): void
    {
        Notification::fake();
        $user = User::factory()->unverified()->create();

        $this->actingAs($user, 'sanctum')->postJson('/api/auth/email/resend')->assertOk();
        $this->actingAs($user, 'sanctum')->postJson('/api/auth/email/resend')->assertTooManyRequests();

        Notification::assertSentToTimes($user, VerifyEmail::class, 1);

        $this->travel(61)->seconds();
        $this->actingAs($user, 'sanctum')->postJson('/api/auth/email/resend')->assertOk();
        Notification::assertSentToTimes($user, VerifyEmail::class, 2);
    }

    public function test_renvoyer_le_lien_est_inutile_si_l_adresse_est_deja_verifiee(): void
    {
        Notification::fake();
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')->postJson('/api/auth/email/resend')->assertStatus(409);
        Notification::assertNothingSent();
    }

    public function test_renvoyer_le_lien_demande_d_etre_connecte(): void
    {
        $this->postJson('/api/auth/email/resend')->assertUnauthorized();
    }

    public function test_un_compte_non_verifie_peut_se_connecter_mais_pas_acceder_aux_espaces(): void
    {
        $user = User::factory()->buyer()->unverified()->create(['email' => 'nv@test.tn']);

        $this->postJson('/api/auth/login', ['email' => 'nv@test.tn', 'password' => 'password'])
            ->assertOk()
            ->assertJsonPath('user.email_verified', false);

        $this->actingAs($user, 'sanctum')->getJson('/api/auth/me')->assertOk();
        $this->actingAs($user, 'sanctum')->getJson('/api/buyer/ping')
            ->assertForbidden()
            ->assertJsonPath('reason', 'email_not_verified');
    }
}
