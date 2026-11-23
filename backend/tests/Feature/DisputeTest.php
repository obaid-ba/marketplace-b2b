<?php

namespace Tests\Feature;

use App\Enums\DisputeStatus;
use App\Enums\OrderStatus;
use App\Enums\ValidationStatus;
use App\Models\AuditLog;
use App\Models\BuyerProfile;
use App\Models\Dispute;
use App\Models\NotificationPreference;
use App\Models\Order;
use App\Models\SupplierProfile;
use App\Models\User;
use App\Notifications\DisputeDecidedNotification;
use App\Notifications\DisputeUpdatedNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/** SCRUM-117 / F23 : litiges (règle métier R4). */
class DisputeTest extends TestCase
{
    use RefreshDatabase;

    private const DESCRIPTION = 'Deux cartons sur dix sont arrivés écrasés.';

    private User $buyer;

    private User $supplier;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->buyer = $this->makeBuyer();
        $this->supplier = $this->makeSupplier();
        $this->admin = User::factory()->admin()->create();
    }

    private function makeBuyer(string $organization = 'Atelier Amel'): User
    {
        $user = User::factory()->buyer()->create();
        BuyerProfile::create(['user_id' => $user->id, 'organization' => $organization, 'sector' => 'BTP']);

        return $user->fresh();
    }

    private function makeSupplier(string $company = 'Atlas SARL'): User
    {
        $user = User::factory()->supplier()->create();
        SupplierProfile::factory()->create([
            'user_id' => $user->id,
            'company_name' => $company,
            'validation_status' => ValidationStatus::VALIDATED,
        ]);

        return $user->fresh();
    }

    private function makeOrder(OrderStatus $status = OrderStatus::DELIVERED, float $total = 450): Order
    {
        return Order::create([
            'buyer_id' => $this->buyer->buyerProfile->id,
            'supplier_id' => $this->supplier->supplierProfile->id,
            'origin' => 'catalogue',
            'total' => $total,
            'status' => $status,
        ]);
    }

    private function openDispute(?Order $order = null): Dispute
    {
        $order ??= $this->makeOrder();
        $id = $this->actingAs($this->buyer, 'sanctum')
            ->postJson("/api/buyer/orders/{$order->id}/dispute", ['reason' => 'Produit endommagé', 'description' => self::DESCRIPTION])
            ->assertCreated()
            ->json('id');

        return Dispute::findOrFail($id);
    }

    // --- Ouverture (R4) ---

    /**
     * @return array<string, array{OrderStatus, bool}>
     */
    public static function statuses(): array
    {
        return [
            'validée' => [OrderStatus::VALIDATED, false],
            'en préparation' => [OrderStatus::IN_PREPARATION, false],
            'en livraison' => [OrderStatus::IN_DELIVERY, true],
            'expédiée' => [OrderStatus::SHIPPED, true],
            'livrée' => [OrderStatus::DELIVERED, true],
            'clôturée' => [OrderStatus::CLOSED, false],
        ];
    }

    #[DataProvider('statuses')]
    public function test_un_litige_s_ouvre_de_l_expedition_a_la_livraison(OrderStatus $status, bool $allowed): void
    {
        $order = $this->makeOrder($status);

        $this->actingAs($this->buyer, 'sanctum')->getJson("/api/orders/{$order->id}/dispute")->assertJsonPath('can_open', $allowed);
        $this->postJson("/api/buyer/orders/{$order->id}/dispute", ['reason' => 'Produit endommagé', 'description' => self::DESCRIPTION])
            ->assertStatus($allowed ? 201 : 422);

        $this->assertDatabaseCount('disputes', $allowed ? 1 : 0);
    }

    public function test_l_ouverture_previent_le_fournisseur_et_les_admins_actifs(): void
    {
        Notification::fake();
        $suspended = User::factory()->admin()->suspended()->create();
        $dispute = $this->openDispute();

        $this->assertSame(DisputeStatus::OPEN, $dispute->status);
        Notification::assertSentTo([$this->supplier, $this->admin], DisputeUpdatedNotification::class);
        Notification::assertNotSentTo([$this->buyer, $suspended], DisputeUpdatedNotification::class);

        $notification = new DisputeUpdatedNotification($dispute, DisputeUpdatedNotification::OPENED);
        $this->assertSame("/admin/litiges/{$dispute->id}", $notification->toArray($this->admin)['url']);
        $this->assertSame("/litiges/{$dispute->id}", $notification->toArray($this->supplier)['url']);
    }

    public function test_seul_l_acheteur_de_la_commande_peut_ouvrir_un_litige(): void
    {
        $order = $this->makeOrder();
        $url = "/api/buyer/orders/{$order->id}/dispute";
        $payload = ['reason' => 'Produit endommagé', 'description' => self::DESCRIPTION];

        $this->postJson($url, $payload)->assertUnauthorized();
        $this->actingAs($this->supplier, 'sanctum')->postJson($url, $payload)->assertForbidden();
        $this->getJson("/api/orders/{$order->id}/dispute")->assertOk()->assertJsonPath('can_open', false);
        $this->actingAs($this->makeBuyer('Autre'), 'sanctum')->postJson($url, $payload)->assertNotFound();
        $this->assertDatabaseCount('disputes', 0);
    }

    public function test_un_seul_litige_en_cours_par_commande(): void
    {
        $dispute = $this->openDispute();
        $url = "/api/buyer/orders/{$dispute->order_id}/dispute";
        $payload = ['reason' => 'Autre problème', 'description' => self::DESCRIPTION];

        foreach ([DisputeStatus::OPEN, DisputeStatus::IN_PROGRESS] as $status) {
            $dispute->update(['status' => $status]);
            $this->postJson($url, $payload)->assertStatus(422)->assertJsonPath('message', 'Un litige est déjà en cours pour cette commande.');
        }
        $this->getJson("/api/orders/{$dispute->order_id}/dispute")->assertJsonPath('can_open', false)->assertJsonPath('dispute.id', $dispute->id);

        // Après une décision (ex. remplacement lui aussi défectueux), un nouveau problème peut être signalé
        $dispute->update(['status' => DisputeStatus::DECIDED]);
        $second = $this->postJson($url, $payload)->assertCreated()->json('id');
        $this->getJson("/api/orders/{$dispute->order_id}/dispute")->assertJsonPath('dispute.id', $second);
    }

    public function test_le_motif_et_la_description_sont_controles(): void
    {
        $url = '/api/buyer/orders/'.$this->makeOrder()->id.'/dispute';

        $this->actingAs($this->buyer, 'sanctum')->postJson($url, [])->assertJsonValidationErrors(['reason', 'description']);
        $this->postJson($url, ['reason' => 'Inventé', 'description' => '   trop court   '])->assertJsonValidationErrors(['reason', 'description']);
    }

    // --- Preuves ---

    public function test_les_preuves_sont_privees(): void
    {
        Storage::fake('local');
        $order = $this->makeOrder();

        $response = $this->actingAs($this->buyer, 'sanctum')->post("/api/buyer/orders/{$order->id}/dispute", [
            'reason' => 'Produit endommagé',
            'description' => self::DESCRIPTION,
            'attachments' => [UploadedFile::fake()->create('carton.jpg', 20, 'image/jpeg'), UploadedFile::fake()->createWithContent('bon.pdf', "%PDF-1.4\n%%EOF")],
        ], ['Accept' => 'application/json'])->assertCreated()->assertJsonCount(2, 'attachments')->assertJsonMissingPath('attachments.0.file_path');

        $url = "/api/disputes/{$response->json('id')}/attachments/{$response->json('attachments.0.id')}";
        foreach ([$this->buyer, $this->supplier, $this->admin] as $user) {
            $this->actingAs($user, 'sanctum')->get($url)->assertOk()->assertDownload('carton.jpg');
        }
        $this->actingAs($this->makeSupplier('Tiers'), 'sanctum')->getJson($url)->assertNotFound();

        // Une pièce jointe ne s'atteint pas par un autre litige
        $other = $this->openDispute($this->makeOrder());
        $this->getJson("/api/disputes/{$other->id}/attachments/{$response->json('attachments.0.id')}")->assertNotFound();
    }

    public function test_les_fichiers_interdits_sont_refuses_sans_rien_enregistrer(): void
    {
        Storage::fake('local');
        $url = '/api/buyer/orders/'.$this->makeOrder()->id.'/dispute';
        $base = ['reason' => 'Produit endommagé', 'description' => self::DESCRIPTION];
        $this->actingAs($this->buyer, 'sanctum');

        foreach ([
            [UploadedFile::fake()->createWithContent('a.svg', '<svg/>')],
            [UploadedFile::fake()->create('gros.pdf', 5121, 'application/pdf')],
        ] as $files) {
            $this->post($url, [...$base, 'attachments' => $files], ['Accept' => 'application/json'])->assertJsonValidationErrors('attachments.0');
        }
        $six = array_map(fn ($i) => UploadedFile::fake()->create("{$i}.jpg", 20, 'image/jpeg'), range(1, 6));
        $this->post($url, [...$base, 'attachments' => $six], ['Accept' => 'application/json'])->assertJsonValidationErrors('attachments');

        $this->assertDatabaseCount('disputes', 0);
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    // --- Consultation ---

    public function test_les_deux_parties_voient_le_litige_sans_les_coordonnees(): void
    {
        $dispute = $this->openDispute();

        foreach ([$this->buyer, $this->supplier] as $user) {
            $this->actingAs($user, 'sanctum')->getJson("/api/disputes/{$dispute->id}")
                ->assertOk()
                ->assertJsonPath('description', self::DESCRIPTION)
                ->assertJsonPath('supplier.name', 'Atlas SARL')
                ->assertJsonMissingPath('buyer.contact')
                ->assertJsonMissingPath('assigned_admin');
            $this->getJson("/api/orders/{$dispute->order_id}/dispute")->assertJsonPath('dispute.id', $dispute->id);
            $this->getJson('/api/admin/disputes')->assertForbidden();
            $this->postJson("/api/admin/disputes/{$dispute->id}/take")->assertForbidden();
        }

        $this->actingAs($this->makeBuyer('Tiers'), 'sanctum')->getJson("/api/disputes/{$dispute->id}")->assertNotFound();
        $this->getJson("/api/orders/{$dispute->order_id}/dispute")->assertNotFound();
    }

    // --- Commande contestée ---

    public function test_une_commande_contestee_ne_se_cloture_pas_avant_la_decision(): void
    {
        $dispute = $this->openDispute();
        $url = "/api/buyer/orders/{$dispute->order_id}/confirm-receipt";

        $this->postJson($url)->assertStatus(422);
        $this->assertSame(OrderStatus::DELIVERED, $dispute->order->fresh()->status);

        $dispute->update(['status' => DisputeStatus::DECIDED]);
        $this->postJson($url)->assertOk();
        $this->assertSame(OrderStatus::CLOSED, $dispute->order->fresh()->status);
    }

    // --- Traitement par l'admin ---

    public function test_la_file_est_triee_par_urgence_et_filtrable(): void
    {
        $this->travelTo(now()->subDays(5));
        $old = $this->openDispute($this->makeOrder(total: 10));
        $this->travelBack();
        $small = $this->openDispute($this->makeOrder(total: 100));
        $big = $this->openDispute($this->makeOrder(total: 900));
        Dispute::whereKey([$small->id, $big->id])->update(['created_at' => now()]);
        $taken = $this->openDispute();
        $taken->update(['status' => DisputeStatus::IN_PROGRESS, 'assigned_admin_id' => $this->admin->id]);
        $decided = $this->openDispute();
        $decided->update(['status' => DisputeStatus::DECIDED, 'decided_at' => now()]);

        $response = $this->actingAs($this->admin, 'sanctum')->getJson('/api/admin/disputes')->assertOk()
            ->assertJsonPath('counts.ouvert', 3)->assertJsonPath('counts.décidé', 1);
        $this->assertSame([$old->id, $big->id, $small->id, $taken->id, $decided->id], array_column($response->json('data'), 'id'));

        $this->getJson('/api/admin/disputes?status=en cours')->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $taken->id);
        $this->getJson('/api/admin/disputes?mine=1')->assertJsonCount(1, 'data');
        $this->getJson("/api/admin/disputes?search={$big->order_id}")->assertJsonCount(1, 'data');
        $this->getJson('/api/admin/disputes?search=atlas')->assertJsonCount(5, 'data');
        $this->getJson('/api/admin/disputes?search=%25')->assertJsonCount(0, 'data');
    }

    public function test_un_admin_prend_en_charge_puis_decide(): void
    {
        $dispute = $this->openDispute();
        Notification::fake();
        $this->actingAs($this->admin, 'sanctum');

        $this->getJson("/api/admin/disputes/{$dispute->id}")->assertOk()
            ->assertJsonPath('data.buyer.contact.email', $this->buyer->email)
            ->assertJsonCount(4, 'decisions');

        $decision = ['decision' => 'Remboursement partiel', 'note' => 'Deux cartons sur dix endommagés, photos à l’appui.'];
        $this->postJson("/api/admin/disputes/{$dispute->id}/decide", $decision)->assertStatus(422);

        $this->postJson("/api/admin/disputes/{$dispute->id}/take")->assertOk()
            ->assertJsonPath('data.status', 'en cours')->assertJsonPath('data.assigned_admin.id', $this->admin->id);
        Notification::assertSentTo([$this->buyer, $this->supplier], DisputeUpdatedNotification::class);

        $this->postJson("/api/admin/disputes/{$dispute->id}/decide", ['decision' => 'Inventée', 'note' => 'court'])->assertJsonValidationErrors(['decision', 'note']);
        $this->postJson("/api/admin/disputes/{$dispute->id}/decide", $decision)->assertOk()
            ->assertJsonPath('data.status', 'décidé')->assertJsonPath('data.decision', 'Remboursement partiel');

        Notification::assertSentTo([$this->buyer, $this->supplier], DisputeDecidedNotification::class);
        $this->assertNotNull($dispute->fresh()->decided_at);
        $this->assertSame(['dispute.taken', 'dispute.decided'], AuditLog::orderBy('id')->pluck('action')->all());
        $this->assertStringContainsString('Remboursement partiel', AuditLog::firstWhere('action', 'dispute.decided')->reason);

        // Une décision est définitive
        $this->postJson("/api/admin/disputes/{$dispute->id}/decide", $decision)->assertStatus(422);
        $this->postJson("/api/admin/disputes/{$dispute->id}/take")->assertStatus(422);
    }

    public function test_un_autre_admin_doit_reprendre_le_litige_pour_decider(): void
    {
        $dispute = $this->openDispute();
        $other = User::factory()->admin()->create();
        $this->actingAs($this->admin, 'sanctum')->postJson("/api/admin/disputes/{$dispute->id}/take")->assertOk();
        Notification::fake();

        $this->actingAs($other, 'sanctum')
            ->postJson("/api/admin/disputes/{$dispute->id}/decide", ['decision' => 'Réclamation rejetée', 'note' => 'Aucune preuve fournie.'])
            ->assertStatus(422);
        $this->postJson("/api/admin/disputes/{$dispute->id}/take")->assertOk()->assertJsonPath('data.assigned_admin.id', $other->id);

        // Reprise interne : tracée, mais les parties ne sont pas prévenues une seconde fois
        Notification::assertNothingSent();
        $this->assertDatabaseHas('audit_logs', ['action' => 'dispute.reassigned', 'admin_id' => $other->id]);

        // Prendre deux fois le même litige ne fait rien
        $this->postJson("/api/admin/disputes/{$dispute->id}/take")->assertOk();
        $this->assertDatabaseCount('audit_logs', 2);
    }

    public function test_l_e_mail_de_decision_ne_peut_pas_etre_desactive(): void
    {
        NotificationPreference::create(['user_id' => $this->buyer->id, 'event_type' => 'dispute_decision', 'channel' => 'email', 'enabled' => false]);
        NotificationPreference::create(['user_id' => $this->supplier->id, 'event_type' => 'dispute_update', 'channel' => 'email', 'enabled' => false]);
        $dispute = $this->openDispute();

        $this->assertContains('mail', (new DisputeDecidedNotification($dispute))->via($this->buyer));
        $this->assertSame(['database'], (new DisputeUpdatedNotification($dispute, DisputeUpdatedNotification::OPENED))->via($this->supplier));
    }
}
