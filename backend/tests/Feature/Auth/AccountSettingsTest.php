<?php

namespace Tests\Feature\Auth;

use App\Enums\UserStatus;
use App\Models\User;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/** SCRUM-27 : modifier ses informations personnelles, son e-mail et son mot de passe. */
class AccountSettingsTest extends TestCase
{
    use RefreshDatabase;

    private function buyer(): User
    {
        $user = User::factory()->buyer()->create([
            'name' => 'Karim Ben Salah',
            'first_name' => 'Karim',
            'last_name' => 'Ben Salah',
            'email' => 'karim@exemple.tn',
            'phone' => '+216 71000000',
        ]);

        $user->buyerProfile()->create([
            'buyer_type' => 'entreprise',
            'organization' => 'Ancienne organisation',
            'sector' => 'Bâtiment',
        ]);

        return $user;
    }

    public function test_le_porteur_met_a_jour_son_nom_son_telephone_et_son_profil(): void
    {
        $user = $this->buyer();

        $this->actingAs($user, 'sanctum')
            ->patchJson('/api/account/profile', [
                'first_name' => '  Salma ',
                'last_name' => ' Trabelsi ',
                'phone' => '98 123 456',
                'organization' => '  Nouvelle organisation ',
                'sector' => ' Informatique ',
            ])
            ->assertOk()
            ->assertJsonPath('message', 'Vos informations ont été mises à jour.')
            ->assertJsonPath('user.name', 'Salma Trabelsi')
            ->assertJsonPath('user.first_name', 'Salma')
            ->assertJsonPath('user.last_name', 'Trabelsi')
            ->assertJsonPath('user.phone', '+216 98123456')
            ->assertJsonPath('user.buyer_profile.organization', 'Nouvelle organisation')
            ->assertJsonPath('user.buyer_profile.sector', 'Informatique');

        $user->refresh();
        $this->assertSame('Salma Trabelsi', $user->name);
        $this->assertSame('+216 98123456', $user->phone);
        $this->assertSame('Nouvelle organisation', $user->buyerProfile->organization);
        $this->assertSame('Informatique', $user->buyerProfile->sector);
    }

    public function test_le_fournisseur_met_a_jour_son_compte_sans_champs_du_porteur(): void
    {
        $user = User::factory()->supplier()->create([
            'first_name' => 'Amel',
            'last_name' => 'Gharbi',
            'phone' => '+216 71000000',
        ]);

        $this->actingAs($user, 'sanctum')
            ->patchJson('/api/account/profile', [
                'first_name' => 'Amel',
                'last_name' => 'Gharbi',
                'phone' => '22123456',
                'organization' => 'Ignoré',
                'sector' => 'Ignoré',
            ])
            ->assertOk()
            ->assertJsonPath('user.phone', '+216 22123456');

        $this->assertDatabaseMissing('buyer_profiles', ['user_id' => $user->id]);
    }

    public function test_les_champs_obligatoires_et_le_telephone_sont_valides(): void
    {
        $user = $this->buyer();

        $this->actingAs($user, 'sanctum')
            ->patchJson('/api/account/profile', [
                'first_name' => '',
                'last_name' => '',
                'phone' => '12345',
                'organization' => '',
                'sector' => '',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['first_name', 'last_name', 'phone', 'organization', 'sector'])
            ->assertJsonPath('errors.phone.0', 'Le téléphone doit contenir 8 chiffres (préfixe +216).');
    }

    public function test_un_compte_non_verifie_peut_toujours_modifier_ses_informations(): void
    {
        $user = User::factory()->buyer()->unverified()->create([
            'first_name' => 'Nadia',
            'last_name' => 'Ayari',
            'phone' => '+216 71000000',
        ]);

        $user->buyerProfile()->create([
            'buyer_type' => 'individu',
            'organization' => 'Projet Nadia',
            'sector' => 'Artisanat',
        ]);

        $this->actingAs($user, 'sanctum')
            ->patchJson('/api/account/profile', [
                'first_name' => 'Nadia',
                'last_name' => 'Ayari',
                'phone' => '71000001',
                'organization' => 'Projet Nadia',
                'sector' => 'Artisanat',
            ])
            ->assertOk()
            ->assertJsonPath('user.phone', '+216 71000001');
    }

    public function test_le_mot_de_passe_est_modifie_avec_l_ancien_mot_de_passe(): void
    {
        $user = User::factory()->create(['password' => 'Password123']);

        $this->actingAs($user, 'sanctum')
            ->putJson('/api/account/password', [
                'current_password' => 'Password123',
                'password' => 'NouveauPass456',
                'password_confirmation' => 'NouveauPass456',
            ])
            ->assertOk()
            ->assertJsonPath('message', 'Votre mot de passe a été modifié. Les autres sessions ont été déconnectées.');

        $this->assertTrue(Hash::check('NouveauPass456', $user->fresh()->password));
    }

    public function test_un_ancien_mot_de_passe_incorrect_est_refuse(): void
    {
        $user = User::factory()->create(['password' => 'Password123']);

        $this->actingAs($user, 'sanctum')
            ->putJson('/api/account/password', [
                'current_password' => 'MauvaisPass123',
                'password' => 'NouveauPass456',
                'password_confirmation' => 'NouveauPass456',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('current_password')
            ->assertJsonPath('errors.current_password.0', 'Le mot de passe actuel est incorrect.');

        $this->assertTrue(Hash::check('Password123', $user->fresh()->password));
    }

    public function test_le_nouveau_mot_de_passe_doit_etre_solide_confirme_et_different(): void
    {
        $user = User::factory()->create(['password' => 'Password123']);

        $this->actingAs($user, 'sanctum')
            ->putJson('/api/account/password', [
                'current_password' => 'Password123',
                'password' => 'password',
                'password_confirmation' => 'password',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['password']);

        $this->actingAs($user, 'sanctum')
            ->putJson('/api/account/password', [
                'current_password' => 'Password123',
                'password' => 'NouveauPass456',
                'password_confirmation' => 'AutrePass456',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['password']);

        $this->actingAs($user, 'sanctum')
            ->putJson('/api/account/password', [
                'current_password' => 'Password123',
                'password' => 'Password123',
                'password_confirmation' => 'Password123',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['password'])
            ->assertJsonPath('errors.password.0', "Le nouveau mot de passe doit être différent de l'ancien.");
    }

    public function test_les_autres_sessions_sont_deconnectees_apres_le_changement_de_mot_de_passe(): void
    {
        $user = User::factory()->create(['password' => 'Password123']);
        $current = $user->createToken('web');
        $other = $user->createToken('mobile');

        $this->withHeader('Authorization', "Bearer {$current->plainTextToken}")
            ->putJson('/api/account/password', [
                'current_password' => 'Password123',
                'password' => 'NouveauPass456',
                'password_confirmation' => 'NouveauPass456',
            ])
            ->assertOk();

        $this->assertDatabaseHas('personal_access_tokens', ['id' => $current->accessToken->id]);
        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $other->accessToken->id]);
    }

    public function test_le_changement_d_e_mail_demande_une_nouvelle_verification(): void
    {
        Notification::fake();
        $user = $this->buyer();

        $this->actingAs($user, 'sanctum')
            ->patchJson('/api/account/email', ['email' => '  Nouvelle@Exemple.TN '])
            ->assertOk()
            ->assertJsonPath('user.email', 'nouvelle@exemple.tn')
            ->assertJsonPath('user.email_verified', false)
            ->assertJsonPath('user.status', UserStatus::EMAIL_TO_VERIFY->value);

        $user->refresh();
        $this->assertSame('nouvelle@exemple.tn', $user->email);
        $this->assertNull($user->email_verified_at);
        $this->assertSame(UserStatus::EMAIL_TO_VERIFY, $user->status);

        Notification::assertSentTo($user, VerifyEmail::class);
    }

    public function test_une_adresse_deja_utilisee_ou_identique_est_refusee(): void
    {
        Notification::fake();
        $user = $this->buyer();
        User::factory()->create(['email' => 'prise@exemple.tn']);

        $this->actingAs($user, 'sanctum')
            ->patchJson('/api/account/email', ['email' => 'prise@exemple.tn'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('email')
            ->assertJsonPath('errors.email.0', 'Un compte existe déjà avec cette adresse e-mail.');

        $this->actingAs($user, 'sanctum')
            ->patchJson('/api/account/email', ['email' => 'karim@exemple.tn'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('email')
            ->assertJsonPath('errors.email.0', "C'est déjà votre adresse e-mail actuelle.");

        $this->assertSame('karim@exemple.tn', $user->fresh()->email);
        Notification::assertNothingSent();
    }

    public function test_les_parametres_du_compte_exigent_une_connexion(): void
    {
        $this->getJson('/api/account')->assertUnauthorized();
        $this->patchJson('/api/account/profile', [])->assertUnauthorized();
        $this->putJson('/api/account/password', [])->assertUnauthorized();
        $this->patchJson('/api/account/email', [])->assertUnauthorized();
    }
}
