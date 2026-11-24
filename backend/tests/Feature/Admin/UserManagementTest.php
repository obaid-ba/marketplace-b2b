<?php

namespace Tests\Feature\Admin;

use App\Enums\OrderStatus;
use App\Enums\ProductStatus;
use App\Enums\QuoteStatus;
use App\Enums\TenderStatus;
use App\Enums\UserStatus;
use App\Models\AuditLog;
use App\Models\BuyerProfile;
use App\Models\Category;
use App\Models\Order;
use App\Models\Product;
use App\Models\Quote;
use App\Models\SupplierProfile;
use App\Models\Tender;
use App\Models\User;
use App\Notifications\AccountReactivatedNotification;
use App\Notifications\AccountSuspendedNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/** SCRUM-118 / F24 : gestion des utilisateurs par l'administrateur. */
class UserManagementTest extends TestCase
{
    use RefreshDatabase;

    private const REASON = 'Annonces trompeuses signalées par trois acheteurs.';

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->admin()->create(['name' => 'Admin', 'created_at' => now()->subYear()]);
    }

    private function makeSupplier(array $user = [], string $company = 'Atlas SARL'): User
    {
        $account = User::factory()->supplier()->create($user);
        SupplierProfile::factory()->visible()->create(['user_id' => $account->id, 'company_name' => $company]);

        return $account->fresh();
    }

    private function makeBuyer(array $user = [], string $organization = 'Atelier Amel'): User
    {
        $account = User::factory()->buyer()->create($user);
        BuyerProfile::create(['user_id' => $account->id, 'organization' => $organization, 'sector' => 'BTP']);

        return $account->fresh();
    }

    private function suspend(User $user)
    {
        return $this->actingAs($this->admin, 'sanctum')->postJson("/api/admin/users/{$user->id}/suspend", ['reason' => self::REASON]);
    }

    private function reactivate(User $user)
    {
        return $this->actingAs($this->admin, 'sanctum')->postJson("/api/admin/users/{$user->id}/reactivate", ['reason' => 'Situation régularisée.']);
    }

    // --- Accès ---

    public function test_la_gestion_est_reservee_aux_admins(): void
    {
        $target = $this->makeBuyer();
        $routes = [['getJson', '/api/admin/users'], ['getJson', "/api/admin/users/{$target->id}"], ['postJson', "/api/admin/users/{$target->id}/suspend"], ['postJson', "/api/admin/users/{$target->id}/reactivate"]];

        foreach ($routes as [$method, $url]) {
            $this->{$method}($url)->assertUnauthorized();
        }
        foreach ([$this->makeSupplier(), $this->makeBuyer()] as $user) {
            $this->actingAs($user, 'sanctum');
            foreach ($routes as [$method, $url]) {
                $this->{$method}($url)->assertForbidden();
            }
        }
    }

    // --- Liste ---

    public function test_la_liste_se_filtre_et_se_recherche(): void
    {
        $supplier = $this->makeSupplier(['name' => 'Sami Vendeur', 'email' => 'sami@test.tn', 'created_at' => now()->subDays(2)]);
        $buyer = $this->makeBuyer(['name' => 'Karim Acheteur', 'created_at' => now()->subDay()]);
        $suspended = $this->makeBuyer(['status' => UserStatus::SUSPENDED, 'created_at' => now()], 'Chantiers du Nord');
        $deleted = $this->makeBuyer(['name' => 'Parti'], 'Ancienne société');
        $deleted->delete();

        $ids = fn (string $query = '') => array_column($this->actingAs($this->admin, 'sanctum')->getJson("/api/admin/users{$query}")->assertOk()->json('data'), 'id');

        $this->assertSame([$suspended->id, $buyer->id, $supplier->id, $this->admin->id], $ids());
        $this->assertSame([$supplier->id], $ids('?role=supplier'));
        $this->assertSame([$suspended->id], $ids('?status=suspendu'));
        $this->assertSame([$deleted->id], $ids('?status=supprimé'));
        $this->assertSame([$supplier->id], $ids('?search=sami@'));
        $this->assertSame([$supplier->id], $ids('?search=atlas'));
        $this->assertSame([$suspended->id], $ids('?search=chantiers'));
        $this->assertSame([], $ids('?search=%25'));
        $this->assertSame([$buyer->id], $ids('?role=buyer&status=actif'));

        $this->getJson('/api/admin/users')
            ->assertJsonPath('counts.actif', 3)->assertJsonPath('counts.suspendu', 1)->assertJsonPath('counts.supprimé', 1)
            ->assertJsonMissingPath('data.0.password');
    }

    public function test_le_tri_par_connexion_met_les_jamais_connectes_en_dernier(): void
    {
        $this->admin->update(['name' => 'Admin']);
        $never = $this->makeBuyer();
        $old = $this->makeBuyer();
        $recent = $this->makeBuyer();
        $old->forceFill(['last_login_at' => now()->subMonth()])->save();
        $recent->forceFill(['last_login_at' => now()])->save();

        $ids = array_column($this->actingAs($this->admin, 'sanctum')->getJson('/api/admin/users?role=buyer&sort=last_login')->json('data'), 'id');
        $this->assertSame([$recent->id, $old->id, $never->id], $ids);
    }

    // --- Fiche ---

    public function test_la_fiche_montre_l_activite_et_l_historique(): void
    {
        $supplier = $this->makeSupplier();
        $buyer = $this->makeBuyer();
        foreach ([OrderStatus::SHIPPED, OrderStatus::CLOSED] as $status) {
            Order::create(['buyer_id' => $buyer->buyerProfile->id, 'supplier_id' => $supplier->supplierProfile->id, 'origin' => 'catalogue', 'total' => 10, 'status' => $status]);
        }
        AuditLog::create(['admin_id' => $this->admin->id, 'action' => 'supplier.validated', 'target' => "supplier_profile:{$supplier->supplierProfile->id}"]);
        AuditLog::create(['admin_id' => $this->admin->id, 'action' => 'user.suspended', 'target' => "user:{$buyer->id}", 'reason' => 'autre compte']);

        $this->actingAs($this->admin, 'sanctum')->getJson("/api/admin/users/{$supplier->id}")->assertOk()
            ->assertJsonPath('user.organization', 'Atlas SARL')
            ->assertJsonPath('user.can_suspend', true)
            ->assertJsonPath('activity.orders', 2)
            ->assertJsonPath('activity.ongoing_orders', 1)
            ->assertJsonCount(1, 'history')
            ->assertJsonPath('history.0.action', 'supplier.validated')
            ->assertJsonPath('history.0.admin', 'Admin');

        $this->getJson("/api/admin/users/{$buyer->id}")->assertJsonPath('activity.orders', 2)->assertJsonPath('activity.tenders', 0);
        $this->getJson("/api/admin/users/{$this->admin->id}")->assertOk()->assertJsonPath('activity', []);
        $this->getJson('/api/admin/users/99999')->assertNotFound();
    }

    // --- Suspension ---

    public function test_la_suspension_ferme_les_sessions_et_bloque_la_connexion(): void
    {
        Notification::fake();
        $buyer = $this->makeBuyer(['email' => 'b@test.tn']);
        $token = $buyer->createToken('web')->plainTextToken;

        $this->suspend($buyer)->assertOk()
            ->assertJsonPath('user.status', 'suspendu')
            ->assertJsonPath('user.can_reactivate', true)
            ->assertJsonPath('history.0.reason', self::REASON);

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/auth/me')->assertUnauthorized();
        $this->postJson('/api/auth/login', ['email' => 'b@test.tn', 'password' => 'password'])->assertForbidden()->assertJsonPath('reason', 'suspended');
        Notification::assertSentTo($buyer, AccountSuspendedNotification::class, fn ($n) => str_contains(implode(' ', $n->toMail($buyer)->introLines), self::REASON));
        $this->assertDatabaseHas('audit_logs', ['admin_id' => $this->admin->id, 'action' => 'user.suspended', 'target' => "user:{$buyer->id}", 'reason' => self::REASON]);
    }

    public function test_un_jeton_restant_ne_donne_pas_acces_a_un_compte_bloque(): void
    {
        $buyer = $this->makeBuyer();
        $token = $buyer->createToken('web')->plainTextToken;
        $this->withToken($token)->getJson('/api/auth/me')->assertOk();

        foreach ([UserStatus::SUSPENDED, UserStatus::DEACTIVATED] as $status) {
            $buyer->forceFill(['status' => $status])->save();
            $this->app['auth']->forgetGuards();
            $this->withToken($token)->getJson('/api/auth/me')->assertUnauthorized();
        }

        // Un compte dont l'e-mail reste à vérifier garde l'accès limité prévu (SCRUM-24)
        $buyer->forceFill(['status' => UserStatus::EMAIL_TO_VERIFY, 'email_verified_at' => null])->save();
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/auth/me')->assertOk();
    }

    public function test_un_fournisseur_suspendu_disparait_et_ne_vend_plus_puis_revient(): void
    {
        Notification::fake();
        $supplier = $this->makeSupplier();
        $buyer = $this->makeBuyer();
        $profile = $supplier->supplierProfile;
        $product = Product::factory()->published()->for($profile, 'supplier')->create(['title' => 'Carton', 'stock' => 100]);
        $tender = Tender::create(['buyer_id' => $buyer->buyerProfile->id, 'title' => 'Besoin', 'description' => 'x', 'category_id' => Category::factory()->create()->id, 'status' => TenderStatus::OPEN]);
        $quote = Quote::create(['tender_id' => $tender->id, 'supplier_id' => $profile->id, 'amount' => 10, 'delivery_days' => 2, 'status' => QuoteStatus::SENT]);
        $order = ['items' => [['product_id' => $product->id, 'quantity' => 1]]];

        $this->suspend($supplier)->assertOk();

        $this->getJson("/api/products/{$product->id}")->assertNotFound();
        $this->getJson('/api/products')->assertJsonCount(0, 'data');
        $this->getJson("/api/suppliers/{$profile->id}")->assertNotFound();
        $this->getJson("/api/suppliers/{$profile->id}/products")->assertJsonCount(0, 'products');
        $this->getJson("/api/suppliers/{$profile->id}/public-reviews")->assertNotFound();
        $this->actingAs($buyer, 'sanctum');
        $this->postJson('/api/buyer/orders', $order)->assertStatus(422);
        $this->postJson("/api/buyer/quotes/{$quote->id}/accept")->assertStatus(422);
        $this->postJson('/api/conversations', ['context_type' => 'direct', 'supplier_id' => $profile->id])->assertStatus(422);
        $this->assertDatabaseCount('orders', 0);
        $this->assertSame(100, $product->fresh()->stock);
        $this->assertSame(ProductStatus::PUBLISHED, $product->fresh()->status);

        $this->reactivate($supplier)->assertOk()->assertJsonPath('user.status', 'actif');

        $this->getJson("/api/products/{$product->id}")->assertOk();
        $this->getJson("/api/suppliers/{$profile->id}")->assertOk();
        $this->actingAs($buyer, 'sanctum')->postJson('/api/buyer/orders', $order)->assertCreated();
        Notification::assertSentTo($supplier, AccountReactivatedNotification::class);
    }

    public function test_le_motif_est_obligatoire(): void
    {
        $buyer = $this->makeBuyer();
        $this->actingAs($this->admin, 'sanctum');

        foreach (['suspend', 'reactivate'] as $action) {
            $this->postJson("/api/admin/users/{$buyer->id}/{$action}", [])->assertJsonValidationErrors('reason');
            $this->postJson("/api/admin/users/{$buyer->id}/{$action}", ['reason' => '   court   '])->assertJsonValidationErrors('reason');
        }
        $this->assertSame(UserStatus::ACTIVE, $buyer->fresh()->status);
    }

    public function test_un_admin_ne_peut_ni_se_bloquer_ni_bloquer_un_autre_admin_ni_agir_sur_un_compte_supprime(): void
    {
        Notification::fake();
        $other = User::factory()->admin()->create();
        $deleted = $this->makeBuyer();
        $deleted->delete();

        foreach ([$this->admin, $other, $deleted] as $target) {
            $this->suspend($target)->assertStatus(422);
            $this->reactivate($target)->assertStatus(422);
            $this->getJson("/api/admin/users/{$target->id}")->assertJsonPath('user.can_suspend', false)->assertJsonPath('user.can_reactivate', false);
        }
        $this->assertSame(UserStatus::ACTIVE, $other->fresh()->status);
        $this->assertDatabaseCount('audit_logs', 0);
        Notification::assertNothingSent();
    }

    // --- Réactivation ---

    public function test_la_reactivation_respecte_la_verification_de_l_e_mail(): void
    {
        Notification::fake();
        $deactivated = $this->makeBuyer(['status' => UserStatus::DEACTIVATED]);
        $unverified = $this->makeBuyer(['status' => UserStatus::SUSPENDED, 'email_verified_at' => null]);

        $this->reactivate($deactivated)->assertOk()->assertJsonPath('user.status', 'actif');
        $this->reactivate($unverified)->assertOk()->assertJsonPath('user.status', 'e-mail à vérifier');
    }

    public function test_une_action_sans_effet_est_refusee(): void
    {
        Notification::fake();
        $buyer = $this->makeBuyer();

        $this->reactivate($buyer)->assertStatus(422);
        $this->suspend($buyer)->assertOk();
        $this->suspend($buyer)->assertStatus(422)->assertJsonPath('message', 'Ce compte est déjà suspendu.');
        $this->assertDatabaseCount('audit_logs', 1);
        Notification::assertSentToTimes($buyer, AccountSuspendedNotification::class, 1);
    }

    public function test_changer_son_mot_de_passe_ne_leve_pas_une_suspension(): void
    {
        $buyer = $this->makeBuyer(['email' => 'b@test.tn']);
        $this->suspend($buyer)->assertOk();
        $token = app('auth.password.broker')->createToken($buyer);

        $this->postJson('/api/auth/reset-password', ['email' => 'b@test.tn', 'token' => $token, 'password' => 'Nouveau2026', 'password_confirmation' => 'Nouveau2026'])->assertOk();

        $this->assertSame(UserStatus::SUSPENDED, $buyer->fresh()->status);
        $this->postJson('/api/auth/login', ['email' => 'b@test.tn', 'password' => 'Nouveau2026'])->assertForbidden();
    }
}
