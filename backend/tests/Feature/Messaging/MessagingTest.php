<?php

namespace Tests\Feature\Messaging;

use App\Enums\OrderStatus;
use App\Enums\QuoteStatus;
use App\Enums\TenderStatus;
use App\Enums\ValidationStatus;
use App\Events\ConversationRead;
use App\Events\MessageSent;
use App\Events\NotificationCreated;
use App\Models\BuyerProfile;
use App\Models\Category;
use App\Models\Conversation;
use App\Models\Order;
use App\Models\Quote;
use App\Models\SupplierProfile;
use App\Models\Tender;
use App\Models\TenderRecipient;
use App\Models\User;
use App\Notifications\NewMessageNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** SCRUM-59, SCRUM-60, SCRUM-61 : messagerie entre porteurs et fournisseurs. */
class MessagingTest extends TestCase
{
    use RefreshDatabase;

    private User $buyer;

    private User $supplier;

    protected function setUp(): void
    {
        parent::setUp();

        $this->buyer = $this->makeBuyer('Atelier Amel');
        $this->supplier = $this->makeSupplier('Atlas SARL');
    }

    private function makeBuyer(string $organization): User
    {
        $user = User::factory()->buyer()->create();
        BuyerProfile::create(['user_id' => $user->id, 'organization' => $organization, 'sector' => 'BTP']);

        return $user->fresh();
    }

    private function makeSupplier(string $company, array $attributes = []): User
    {
        $user = User::factory()->supplier()->create();
        SupplierProfile::factory()->create([
            'user_id' => $user->id,
            'company_name' => $company,
            'validation_status' => ValidationStatus::VALIDATED,
            'is_published' => true,
            ...$attributes,
        ]);

        return $user->fresh();
    }

    private function makeTender(): Tender
    {
        return Tender::create([
            'buyer_id' => $this->buyer->buyerProfile->id,
            'title' => 'Ciment pour chantier',
            'description' => 'Besoin de 200 sacs',
            'category_id' => Category::factory()->create()->id,
            'status' => TenderStatus::OPEN,
        ]);
    }

    private function invite(Tender $tender, User $supplier): void
    {
        TenderRecipient::create([
            'tender_id' => $tender->id,
            'supplier_id' => $supplier->supplierProfile->id,
            'score' => 80,
            'source' => 'automatique',
            'notified_at' => now(),
        ]);
    }

    private function openDirect(): Conversation
    {
        $id = $this->actingAs($this->buyer, 'sanctum')->postJson('/api/conversations', [
            'context_type' => 'direct',
            'supplier_id' => $this->supplier->supplierProfile->id,
        ])->assertCreated()->json('id');

        return Conversation::findOrFail($id);
    }

    private function send(User $user, Conversation $conversation, string $body = 'Bonjour'): int
    {
        return $this->actingAs($user, 'sanctum')
            ->postJson("/api/conversations/{$conversation->id}/messages", ['body' => $body])
            ->assertCreated()
            ->json('id');
    }

    // --- Ouvrir une conversation (SCRUM-61) ---

    public function test_un_porteur_contacte_un_fournisseur_et_retrouve_la_meme_conversation(): void
    {
        $conversation = $this->openDirect();

        $this->postJson('/api/conversations', ['context_type' => 'direct', 'supplier_id' => $this->supplier->supplierProfile->id])
            ->assertOk()
            ->assertJsonPath('id', $conversation->id)
            ->assertJsonPath('party.name', 'Atlas SARL')
            ->assertJsonPath('context.label', 'Contact direct');

        $this->assertDatabaseCount('conversations', 1);
        $this->assertDatabaseCount('conversation_participants', 2);
    }

    public function test_le_contact_direct_est_reserve_aux_porteurs_et_aux_fournisseurs_visibles(): void
    {
        $hidden = $this->makeSupplier('Cachée', ['is_published' => false]);
        $pending = $this->makeSupplier('En attente', ['validation_status' => ValidationStatus::PENDING]);

        foreach ([$hidden, $pending] as $target) {
            $this->actingAs($this->buyer, 'sanctum')
                ->postJson('/api/conversations', ['context_type' => 'direct', 'supplier_id' => $target->supplierProfile->id])
                ->assertStatus(422);
        }

        $this->actingAs($this->supplier, 'sanctum')
            ->postJson('/api/conversations', ['context_type' => 'direct', 'supplier_id' => $hidden->supplierProfile->id])
            ->assertForbidden();

        $this->assertDatabaseCount('conversations', 0);
    }

    public function test_une_conversation_liee_a_une_demande_exige_un_destinataire(): void
    {
        $tender = $this->makeTender();
        $payload = ['context_type' => 'demande', 'context_id' => $tender->id];

        // Pas encore destinataire
        $this->actingAs($this->supplier, 'sanctum')->postJson('/api/conversations', $payload)->assertForbidden();

        $this->invite($tender, $this->supplier);

        $id = $this->postJson('/api/conversations', $payload)
            ->assertCreated()
            ->assertJsonPath('context.label', 'Demande : Ciment pour chantier')
            ->assertJsonPath('party.name', 'Atelier Amel')
            ->json('id');

        // Le porteur rejoint la même conversation
        $this->actingAs($this->buyer, 'sanctum')
            ->postJson('/api/conversations', [...$payload, 'supplier_id' => $this->supplier->supplierProfile->id])
            ->assertOk()
            ->assertJsonPath('id', $id);

        // Un autre porteur ne peut pas s'y glisser
        $this->actingAs($this->makeBuyer('Autre'), 'sanctum')
            ->postJson('/api/conversations', [...$payload, 'supplier_id' => $this->supplier->supplierProfile->id])
            ->assertForbidden();
    }

    public function test_un_fournisseur_ne_peut_pas_parler_au_nom_d_un_autre(): void
    {
        $tender = $this->makeTender();
        $this->invite($tender, $this->supplier);
        $intruder = $this->makeSupplier('Intrus');

        $this->actingAs($intruder, 'sanctum')->postJson('/api/conversations', [
            'context_type' => 'demande',
            'context_id' => $tender->id,
            'supplier_id' => $this->supplier->supplierProfile->id,
        ])->assertForbidden();
    }

    public function test_conversations_liees_a_un_devis_et_a_une_commande(): void
    {
        $quote = Quote::create([
            'tender_id' => $this->makeTender()->id,
            'supplier_id' => $this->supplier->supplierProfile->id,
            'amount' => 900,
            'delivery_days' => 5,
            'status' => QuoteStatus::SENT,
        ]);
        $order = Order::create([
            'buyer_id' => $this->buyer->buyerProfile->id,
            'supplier_id' => $this->supplier->supplierProfile->id,
            'origin' => 'catalogue',
            'total' => 450,
            'status' => OrderStatus::VALIDATED,
        ]);

        foreach ([['devis', $quote->id, 'Devis : Ciment pour chantier'], ['commande', $order->id, "Commande n° {$order->id}"]] as [$type, $id, $label]) {
            $payload = ['context_type' => $type, 'context_id' => $id];

            $this->actingAs($this->makeBuyer('Tiers'), 'sanctum')->postJson('/api/conversations', $payload)->assertForbidden();
            $first = $this->actingAs($this->buyer, 'sanctum')->postJson('/api/conversations', $payload)
                ->assertCreated()->assertJsonPath('context.label', $label)->json('id');
            $this->actingAs($this->supplier, 'sanctum')->postJson('/api/conversations', $payload)
                ->assertOk()->assertJsonPath('id', $first);
        }

        $this->postJson('/api/conversations', ['context_type' => 'commande', 'context_id' => 99999])->assertStatus(422);
        $this->postJson('/api/conversations', ['context_type' => 'commande'])->assertJsonValidationErrors('context_id');
    }

    // --- Échanger des messages (SCRUM-60) ---

    public function test_les_deux_parties_echangent_et_le_message_est_diffuse(): void
    {
        Event::fake([MessageSent::class]);
        $conversation = $this->openDirect();

        $first = $this->send($this->buyer, $conversation, '  Bonjour, avez-vous du stock ?  ');
        $this->send($this->supplier, $conversation, 'Oui, 300 sacs.');

        $this->actingAs($this->buyer, 'sanctum')->getJson("/api/conversations/{$conversation->id}/messages")
            ->assertOk()
            ->assertJsonPath('has_more', false)
            ->assertJsonPath('data.0.body', 'Bonjour, avez-vous du stock ?')
            ->assertJsonPath('data.0.is_mine', true)
            ->assertJsonPath('data.1.is_mine', false);

        // Nouveaux messages seulement
        $this->getJson("/api/conversations/{$conversation->id}/messages?after={$first}")
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.body', 'Oui, 300 sacs.');

        Event::assertDispatched(MessageSent::class, function (MessageSent $event) use ($conversation) {
            $channels = collect($event->broadcastOn())->map->name->sort()->values()->all();

            return $channels === collect(["private-user.{$this->buyer->id}", "private-user.{$this->supplier->id}"])->sort()->values()->all()
                && $event->broadcastWith()['conversation_id'] === $conversation->id
                && ! array_key_exists('body', $event->broadcastWith());
        });
    }

    public function test_un_message_vide_ou_trop_long_est_refuse(): void
    {
        $conversation = $this->openDirect();

        $this->postJson("/api/conversations/{$conversation->id}/messages", ['body' => '   '])->assertJsonValidationErrors('body');
        $this->postJson("/api/conversations/{$conversation->id}/messages", ['body' => str_repeat('a', 5001)])->assertJsonValidationErrors('body');
        $this->assertDatabaseCount('messages', 0);
    }

    public function test_une_piece_jointe_est_privee_et_telechargeable_par_les_participants(): void
    {
        Storage::fake('local');
        $conversation = $this->openDirect();

        $id = $this->actingAs($this->buyer, 'sanctum')
            ->post("/api/conversations/{$conversation->id}/messages", [
                'attachment' => UploadedFile::fake()->createWithContent('plan chantier.pdf', "%PDF-1.4\n%%EOF"),
            ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('body', '')
            ->assertJsonPath('attachment.name', 'plan chantier.pdf')
            ->assertJsonMissingPath('attachment_path')
            ->json('id');

        $url = "/api/conversations/{$conversation->id}/messages/{$id}/attachment";
        $this->actingAs($this->supplier, 'sanctum')->get($url)->assertOk()->assertDownload('plan chantier.pdf');
        $this->actingAs($this->makeSupplier('Tiers'), 'sanctum')->getJson($url)->assertNotFound();
    }

    public function test_les_fichiers_dangereux_ou_trop_lourds_sont_refuses(): void
    {
        Storage::fake('local');
        $conversation = $this->openDirect();

        // Vrai fichier : le type est lu dans le contenu (les fichiers « fake » le déduisent de leur nom).
        $disguised = tempnam(sys_get_temp_dir(), 'mb2b');
        file_put_contents($disguised, '<?php echo 1;');

        foreach ([
            UploadedFile::fake()->createWithContent('page.html', '<script>alert(1)</script>'),
            UploadedFile::fake()->createWithContent('image.svg', '<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'),
            new UploadedFile($disguised, 'facture.pdf', 'application/pdf', null, true),
            UploadedFile::fake()->create('gros.pdf', 10241, 'application/pdf'),
        ] as $file) {
            $this->post("/api/conversations/{$conversation->id}/messages", ['attachment' => $file], ['Accept' => 'application/json'])
                ->assertJsonValidationErrors('attachment');
        }

        @unlink($disguised);
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_un_message_est_envoye_meme_si_le_serveur_temps_reel_est_arrete(): void
    {
        $conversation = $this->openDirect();
        // Vrai client Reverb vers un port fermé : l'échec doit se produire au même moment qu'en réalité.
        config([
            'broadcasting.default' => 'reverb',
            'broadcasting.connections.reverb.key' => 'k',
            'broadcasting.connections.reverb.secret' => 's',
            'broadcasting.connections.reverb.app_id' => 'a',
            'broadcasting.connections.reverb.options' => ['host' => '127.0.0.1', 'port' => 1, 'scheme' => 'http', 'useTLS' => false],
        ]);

        $this->send($this->buyer, $conversation, 'Toujours là');
        $this->assertDatabaseHas('messages', ['body' => 'Toujours là']);
        $this->assertSame(1, $this->supplier->unreadNotifications()->count());

        $this->actingAs($this->supplier, 'sanctum')->postJson("/api/conversations/{$conversation->id}/read")->assertOk();
    }

    public function test_l_historique_est_pagine_vers_le_passe(): void
    {
        $conversation = $this->openDirect();
        for ($i = 1; $i <= 35; $i++) {
            $conversation->messages()->create(['sender_id' => $this->buyer->id, 'body' => "m{$i}", 'sent_at' => now()]);
        }

        $page = $this->getJson("/api/conversations/{$conversation->id}/messages")
            ->assertJsonCount(30, 'data')->assertJsonPath('has_more', true)->assertJsonPath('data.29.body', 'm35');

        $this->getJson("/api/conversations/{$conversation->id}/messages?before=".$page->json('data.0.id'))
            ->assertJsonCount(5, 'data')->assertJsonPath('has_more', false)->assertJsonPath('data.0.body', 'm1');
    }

    // --- Liste et non lus (SCRUM-59) ---

    public function test_la_liste_affiche_le_dernier_message_et_les_non_lus(): void
    {
        $conversation = $this->openDirect();
        $this->getJson('/api/conversations')->assertJsonCount(0, 'data'); // ouverte, mais sans message

        $this->send($this->buyer, $conversation, 'Un');
        $this->send($this->buyer, $conversation, 'Deux');

        $this->getJson('/api/conversations')->assertJsonPath('data.0.unread_count', 0);

        $this->actingAs($this->supplier, 'sanctum')->getJson('/api/conversations')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.unread_count', 2)
            ->assertJsonPath('data.0.last_message.body', 'Deux')
            ->assertJsonPath('data.0.party.name', 'Atelier Amel');
        $this->getJson('/api/conversations/unread-count')->assertJsonPath('count', 2);
        $this->getJson('/api/conversations?unread=1')->assertJsonCount(1, 'data');
        $this->getJson('/api/conversations?search=amel')->assertJsonCount(1, 'data');
        $this->getJson('/api/conversations?search=inconnu')->assertJsonCount(0, 'data');
        $this->getJson('/api/conversations?search=%25')->assertJsonCount(0, 'data');

        Event::fake([ConversationRead::class]);
        $this->postJson("/api/conversations/{$conversation->id}/read")->assertJsonPath('unread_total', 0);
        $this->postJson("/api/conversations/{$conversation->id}/read")->assertOk();
        Event::assertDispatchedTimes(ConversationRead::class, 1);

        $this->getJson('/api/conversations?unread=1')->assertJsonCount(0, 'data');
        $this->actingAs($this->buyer, 'sanctum')->getJson("/api/conversations/{$conversation->id}")
            ->assertJsonPath('other_last_read_message_id', $conversation->messages()->max('id'));
    }

    public function test_un_tiers_ne_voit_ni_ne_modifie_une_conversation(): void
    {
        $conversation = $this->openDirect();
        $this->send($this->buyer, $conversation, 'Secret');

        foreach ([$this->makeBuyer('Tiers'), $this->makeSupplier('Tiers')] as $outsider) {
            $this->actingAs($outsider, 'sanctum');
            $this->getJson('/api/conversations')->assertJsonCount(0, 'data');
            $this->getJson("/api/conversations/{$conversation->id}")->assertNotFound();
            $this->getJson("/api/conversations/{$conversation->id}/messages")->assertNotFound();
            $this->postJson("/api/conversations/{$conversation->id}/messages", ['body' => 'Intrusion'])->assertNotFound();
            $this->postJson("/api/conversations/{$conversation->id}/read")->assertNotFound();
        }

        $this->actingAs(User::factory()->admin()->create(), 'sanctum')->getJson('/api/conversations')->assertForbidden();
        $this->actingAs(User::factory()->buyer()->unverified()->create(), 'sanctum')->getJson('/api/conversations')->assertForbidden();
        $this->assertDatabaseCount('messages', 1);
    }

    public function test_la_messagerie_demande_d_etre_connecte(): void
    {
        $this->getJson('/api/conversations')->assertUnauthorized();
        $this->postJson('/api/conversations', [])->assertUnauthorized();
    }

    // --- Notifications (SCRUM-62, SCRUM-63) ---

    public function test_une_seule_notification_tant_que_la_conversation_n_est_pas_lue(): void
    {
        $conversation = $this->openDirect();
        Notification::fake();

        $this->send($this->buyer, $conversation, 'Un');
        $this->send($this->buyer, $conversation, 'Deux');
        Notification::assertSentToTimes($this->supplier, NewMessageNotification::class, 1);
        Notification::assertNotSentTo($this->buyer, NewMessageNotification::class);

        $this->actingAs($this->supplier, 'sanctum')->postJson("/api/conversations/{$conversation->id}/read");
        $this->send($this->buyer, $conversation, 'Trois');
        Notification::assertSentToTimes($this->supplier, NewMessageNotification::class, 2);
    }

    public function test_lire_la_conversation_marque_sa_notification_comme_lue(): void
    {
        $conversation = $this->openDirect();
        Event::fake([NotificationCreated::class]);
        $this->send($this->buyer, $conversation, 'Bonjour');

        $this->actingAs($this->supplier, 'sanctum')->getJson('/api/notifications')
            ->assertJsonPath('data.0.title', 'Nouveau message de Atelier Amel')
            ->assertJsonPath('data.0.url', "/fournisseur/messagerie/{$conversation->id}");
        Event::assertDispatched(NotificationCreated::class, fn ($event) => $event->userId === $this->supplier->id);

        $this->postJson("/api/conversations/{$conversation->id}/read")->assertOk();
        $this->getJson('/api/notifications/unread-count')->assertJsonPath('count', 0);
    }

    public function test_l_evenement_message_est_reglable_dans_les_preferences(): void
    {
        $this->actingAs($this->supplier, 'sanctum')->putJson('/api/notifications/preferences', [
            'preferences' => [['event_type' => 'message_received', 'channel' => 'email', 'enabled' => false]],
        ])->assertOk();

        $conversation = $this->openDirect();
        $message = $conversation->messages()->create(['sender_id' => $this->buyer->id, 'body' => 'x', 'sent_at' => now()]);

        $this->assertSame(['database'], (new NewMessageNotification($message))->via($this->supplier));
        $this->assertContains('mail', (new NewMessageNotification($message))->via($this->buyer));
    }

    // --- Canal temps réel ---

    public function test_chacun_n_ecoute_que_son_propre_canal(): void
    {
        config([
            'broadcasting.default' => 'reverb',
            'broadcasting.connections.reverb.key' => 'k',
            'broadcasting.connections.reverb.secret' => 's',
            'broadcasting.connections.reverb.app_id' => 'a',
        ]);
        require base_path('routes/channels.php');

        $auth = fn (int $id) => $this->postJson('/api/broadcasting/auth', ['socket_id' => '1.1', 'channel_name' => "private-user.{$id}"]);

        $auth($this->buyer->id)->assertUnauthorized();
        $this->actingAs($this->buyer, 'sanctum');
        $auth($this->buyer->id)->assertOk()->assertJsonStructure(['auth']);
        $auth($this->supplier->id)->assertForbidden();
    }
}
