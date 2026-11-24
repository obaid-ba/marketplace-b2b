<?php

namespace Tests\Feature;

use App\Enums\DisputeStatus;
use App\Enums\OrderStatus;
use App\Models\Dispute;
use App\Models\User;
use App\Notifications\DisputeOpenedNotification;
use App\Notifications\DisputeUpdatedNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * SCRUM-67 / SCRUM-73 / F21 — litiges.
 */
class DisputeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        Notification::fake();
    }

    /**
     * @return array{buyer: User, supplier: User, order: int}
     */
    private function order(string $status = OrderStatus::SHIPPED->value): array
    {
        $buyer = User::factory()->buyer()->create();
        $buyerProfile = $buyer->buyerProfile()->create(['organization' => 'Acheteur']);

        $supplier = User::factory()->supplier()->create();
        $supplierProfile = $supplier->supplierProfile()->create(['company_name' => 'Atlas']);

        $order = DB::table('orders')->insertGetId([
            'buyer_id' => $buyerProfile->id,
            'supplier_id' => $supplierProfile->id,
            'origin' => 'catalogue',
            'total' => 500.00,
            'status' => $status,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return ['buyer' => $buyer, 'supplier' => $supplier, 'order' => $order];
    }

    private function admin(): User
    {
        return User::factory()->admin()->create();
    }

    public function test_les_litiges_sont_reserves_aux_roles_concernes(): void
    {
        $this->getJson('/api/buyer/disputes')->assertUnauthorized();
        $this->getJson('/api/admin/disputes')->assertUnauthorized();

        $this->actingAs(User::factory()->supplier()->create(), 'sanctum')
            ->getJson('/api/buyer/disputes')
            ->assertForbidden();

        $this->actingAs(User::factory()->buyer()->create(), 'sanctum')
            ->getJson('/api/admin/disputes')
            ->assertForbidden();
    }

    public function test_un_acheteur_ouvre_un_litige_apres_expedition_avec_piece_jointe(): void
    {
        ['buyer' => $buyer, 'supplier' => $supplier, 'order' => $orderId] = $this->order();
        $admin = $this->admin();

        $response = $this->actingAs($buyer, 'sanctum')
            ->post("/api/buyer/orders/{$orderId}/disputes", [
                'reason' => 'Produit endommagé',
                'description' => 'Deux cartons sur dix sont arrivés écrasés.',
                'attachments' => [UploadedFile::fake()->create('preuve.pdf', 120, 'application/pdf')],
            ], ['Accept' => 'application/json'])
            ->assertStatus(201)
            ->assertJsonPath('dispute.status', DisputeStatus::OPEN->value);

        $dispute = Dispute::findOrFail($response->json('dispute.id'));

        $this->assertDatabaseHas('disputes', [
            'id' => $dispute->id,
            'order_id' => $orderId,
            'opened_by' => $buyer->id,
            'status' => DisputeStatus::OPEN->value,
        ]);
        $this->assertCount(1, $dispute->attachments);
        Storage::disk('local')->assertExists($dispute->attachments->first()->file_path);

        Notification::assertSentTo($admin, DisputeOpenedNotification::class);
        Notification::assertSentTo($supplier, DisputeOpenedNotification::class);
    }

    public function test_un_litige_ne_peut_pas_etre_ouvert_apres_cloture_ni_en_double(): void
    {
        ['buyer' => $buyer, 'order' => $closedOrder] = $this->order(OrderStatus::CLOSED->value);

        $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/buyer/orders/{$closedOrder}/disputes", [
                'reason' => 'Produit non conforme',
                'description' => 'La commande est déjà clôturée.',
            ])
            ->assertStatus(422);

        ['buyer' => $buyer2, 'order' => $shippedOrder] = $this->order();

        $payload = [
            'reason' => 'Retard de livraison',
            'description' => 'La livraison a plus de dix jours de retard.',
        ];

        $this->actingAs($buyer2, 'sanctum')
            ->postJson("/api/buyer/orders/{$shippedOrder}/disputes", $payload)
            ->assertStatus(201);

        $this->actingAs($buyer2, 'sanctum')
            ->postJson("/api/buyer/orders/{$shippedOrder}/disputes", $payload)
            ->assertStatus(422)
            ->assertJsonPath('message', 'Un litige est déjà en cours pour cette commande.');
    }

    public function test_un_acheteur_ne_peut_pas_ouvrir_un_litige_sur_la_commande_d_un_autre(): void
    {
        ['order' => $orderId] = $this->order();
        $intruder = User::factory()->buyer()->create();
        $intruder->buyerProfile()->create(['organization' => 'Intrus']);

        $this->actingAs($intruder, 'sanctum')
            ->postJson("/api/buyer/orders/{$orderId}/disputes", [
                'reason' => 'Tentative',
                'description' => 'Cette commande ne m\'appartient pas.',
            ])
            ->assertForbidden();
    }

    public function test_l_admin_trie_par_urgence_prend_en_charge_et_decide(): void
    {
        $admin = $this->admin();
        ['buyer' => $buyer, 'order' => $orderOne] = $this->order();
        ['order' => $orderTwo] = $this->order();
        ['order' => $orderThree] = $this->order();

        $oldOpen = DB::table('disputes')->insertGetId([
            'order_id' => $orderOne,
            'opened_by' => $buyer->id,
            'reason' => 'Ancien litige ouvert',
            'description' => 'Description',
            'status' => DisputeStatus::OPEN->value,
            'created_at' => '2027-01-01 10:00:00',
            'updated_at' => '2027-01-01 10:00:00',
        ]);
        $newOpen = DB::table('disputes')->insertGetId([
            'order_id' => $orderTwo,
            'opened_by' => $buyer->id,
            'reason' => 'Litige récent',
            'description' => 'Description',
            'status' => DisputeStatus::OPEN->value,
            'created_at' => '2027-01-05 10:00:00',
            'updated_at' => '2027-01-05 10:00:00',
        ]);
        $decided = DB::table('disputes')->insertGetId([
            'order_id' => $orderThree,
            'opened_by' => $buyer->id,
            'reason' => 'Litige décidé',
            'description' => 'Description',
            'status' => DisputeStatus::DECIDED->value,
            'decision' => 'Remboursement',
            'decision_note' => 'Preuves fournies.',
            'created_at' => '2026-12-01 10:00:00',
            'updated_at' => '2026-12-01 10:00:00',
        ]);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/disputes')
            ->assertOk()
            ->assertJsonPath('data.0.id', $oldOpen)
            ->assertJsonPath('data.1.id', $newOpen)
            ->assertJsonPath('data.2.id', $decided);

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/disputes/{$oldOpen}/assign")
            ->assertOk()
            ->assertJsonPath('dispute.status', DisputeStatus::IN_PROGRESS->value)
            ->assertJsonPath('dispute.assigned_admin_id', $admin->id);

        $this->assertDatabaseHas('audit_logs', [
            'admin_id' => $admin->id,
            'action' => 'dispute.assigned',
            'target' => "dispute:{$oldOpen}",
        ]);
        Notification::assertSentTo($buyer, DisputeUpdatedNotification::class);

        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/disputes/{$oldOpen}/decide", [
                'decision' => 'Remboursement partiel',
                'note' => 'Deux cartons endommagés confirmés par les photos.',
            ])
            ->assertOk()
            ->assertJsonPath('dispute.status', DisputeStatus::DECIDED->value)
            ->assertJsonPath('dispute.decision', 'Remboursement partiel');

        $this->assertDatabaseHas('audit_logs', [
            'admin_id' => $admin->id,
            'action' => 'dispute.decided',
            'target' => "dispute:{$oldOpen}",
            'reason' => 'Deux cartons endommagés confirmés par les photos.',
        ]);

        // Une décision est obligatoire et motivée.
        $this->actingAs($admin, 'sanctum')
            ->postJson("/api/admin/disputes/{$newOpen}/decide", ['decision' => 'Refus'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('note');
    }

    public function test_le_fournisseur_consulte_les_litiges_de_ses_commandes(): void
    {
        ['supplier' => $supplier, 'buyer' => $buyer, 'order' => $orderId] = $this->order();

        DB::table('disputes')->insert([
            'order_id' => $orderId,
            'opened_by' => $buyer->id,
            'reason' => 'Produit manquant',
            'description' => 'Description',
            'status' => DisputeStatus::OPEN->value,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($supplier, 'sanctum')
            ->getJson('/api/supplier/disputes')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.reason', 'Produit manquant');
    }
}
