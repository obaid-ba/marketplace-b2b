<?php

namespace Tests\Feature\Auth;

use App\Enums\OrderStatus;
use App\Enums\ReviewStatus;
use App\Enums\UserStatus;
use App\Models\SupplierProfile;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * SCRUM-30 : désactiver ou supprimer son compte.
 * Confirmation par mot de passe, suppression douce de l'historique et
 * disparition du catalogue, déconnexion immédiate de tous les appareils.
 */
class AccountDeletionTest extends TestCase
{
    use RefreshDatabase;

    private function supplierWithPublishedProfile(): User
    {
        $user = User::factory()->supplier()->create(['email' => 'fournisseur@test.tn']);

        $user->supplierProfile()->create([
            'company_name' => 'Société Exemple',
            'sector' => 'Informatique',
            'is_published' => true,
        ]);

        return $user;
    }

    public function test_la_desactivation_exige_le_mot_de_passe(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/account/deactivate')
            ->assertStatus(422)
            ->assertJsonValidationErrors('password');

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/account/deactivate', ['password' => 'mauvais'])
            ->assertStatus(422)
            ->assertJsonPath('errors.password.0', 'Le mot de passe est incorrect.');

        $this->assertSame(UserStatus::ACTIVE, $user->fresh()->status);
    }

    public function test_un_porteur_desactive_son_compte_et_est_deconnecte_partout(): void
    {
        $user = User::factory()->buyer()->create(['email' => 'porteur@test.tn']);
        $user->createToken('web');
        $token = $user->createToken('mobile')->plainTextToken;

        $this->withToken($token)
            ->postJson('/api/account/deactivate', ['password' => 'password'])
            ->assertOk()
            ->assertJsonPath('message', 'Votre compte a été désactivé. Vous êtes déconnecté de tous vos appareils.');

        $user->refresh();
        $this->assertSame(UserStatus::DEACTIVATED, $user->status);
        $this->assertNull($user->deleted_at, 'La désactivation ne supprime pas la ligne.');
        $this->assertDatabaseCount('personal_access_tokens', 0);

        // Le jeton révoqué ne donne plus accès.
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/auth/me')->assertUnauthorized();

        // Et la connexion explique que le compte est désactivé.
        $this->postJson('/api/auth/login', ['email' => 'porteur@test.tn', 'password' => 'password'])
            ->assertForbidden()
            ->assertJsonPath('reason', 'deactivated');
    }

    public function test_un_fournisseur_desactive_disparait_du_catalogue(): void
    {
        $user = $this->supplierWithPublishedProfile();

        $this->assertSame(1, SupplierProfile::visibleInCatalog()->count());

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/account/deactivate', ['password' => 'password'])
            ->assertOk();

        $this->assertFalse($user->supplierProfile()->first()->is_published);
        $this->assertSame(0, SupplierProfile::visibleInCatalog()->count());
    }

    public function test_la_suppression_est_douce_et_conserve_commandes_factures_et_avis(): void
    {
        $buyer = User::factory()->buyer()->create(['email' => 'acheteur@test.tn']);
        $buyerProfile = $buyer->buyerProfile()->create(['organization' => 'Entreprise Acheteuse']);

        $supplier = $this->supplierWithPublishedProfile();
        $supplierProfile = $supplier->supplierProfile()->first();

        $orderId = DB::table('orders')->insertGetId([
            'buyer_id' => $buyerProfile->id,
            'supplier_id' => $supplierProfile->id,
            'origin' => 'catalogue',
            'total' => 1250.00,
            'status' => OrderStatus::VALIDATED->value,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('documents')->insert([
            'order_id' => $orderId,
            'type' => 'facture',
            'number' => 'FAC-2026-0001',
            'pdf_path' => 'documents/fac-2026-0001.pdf',
            'issued_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('reviews')->insert([
            'order_id' => $orderId,
            'buyer_id' => $buyerProfile->id,
            'supplier_id' => $supplierProfile->id,
            'rating' => 5,
            'comment' => 'Très bon fournisseur.',
            'status' => ReviewStatus::PUBLISHED->value,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $token = $buyer->createToken('web')->plainTextToken;

        $this->withToken($token)
            ->deleteJson('/api/account', ['password' => 'password'])
            ->assertOk()
            ->assertJsonPath('message', 'Votre compte a été supprimé. Vos commandes, factures et avis sont conservés.');

        $this->assertSoftDeleted('users', ['id' => $buyer->id]);
        $this->assertDatabaseCount('personal_access_tokens', 0);

        // L'historique reste disponible malgré la suppression du compte.
        $this->assertDatabaseHas('buyer_profiles', ['id' => $buyerProfile->id]);
        $this->assertDatabaseHas('orders', ['id' => $orderId]);
        $this->assertDatabaseHas('documents', ['order_id' => $orderId]);
        $this->assertDatabaseHas('reviews', ['order_id' => $orderId]);

        // Un compte supprimé ne peut plus se connecter.
        $this->postJson('/api/auth/login', ['email' => 'acheteur@test.tn', 'password' => 'password'])
            ->assertStatus(422);
    }

    public function test_un_fournisseur_supprime_disparait_du_catalogue(): void
    {
        $supplier = $this->supplierWithPublishedProfile();
        $this->assertSame(1, SupplierProfile::visibleInCatalog()->count());

        $this->actingAs($supplier, 'sanctum')
            ->deleteJson('/api/account', ['password' => 'password'])
            ->assertOk();

        $this->assertSoftDeleted('users', ['id' => $supplier->id]);
        $this->assertFalse($supplier->supplierProfile()->first()->is_published);
        $this->assertSame(0, SupplierProfile::visibleInCatalog()->count());
    }

    public function test_la_suppression_exige_le_mot_de_passe(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum')
            ->deleteJson('/api/account', ['password' => 'mauvais'])
            ->assertStatus(422)
            ->assertJsonPath('errors.password.0', 'Le mot de passe est incorrect.');

        $this->assertNotSoftDeleted('users', ['id' => $user->id]);
    }

    public function test_un_visiteur_ne_peut_pas_supprimer_un_compte(): void
    {
        $this->deleteJson('/api/account', ['password' => 'password'])->assertUnauthorized();
        $this->postJson('/api/account/deactivate', ['password' => 'password'])->assertUnauthorized();
    }
}
