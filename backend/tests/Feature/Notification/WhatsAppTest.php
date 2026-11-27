<?php

namespace Tests\Feature\Notification;

use App\Enums\OrderStatus;
use App\Enums\ValidationStatus;
use App\Enums\WhatsAppStatus;
use App\Models\BuyerProfile;
use App\Models\NotificationPreference;
use App\Models\Order;
use App\Models\SupplierProfile;
use App\Models\User;
use App\Models\WhatsAppDelivery;
use App\Notifications\Channels\WhatsAppChannel;
use App\Notifications\Concerns\RespectsNotificationPreferences;
use App\Notifications\DisputeDecidedNotification;
use App\Notifications\OrderStatusUpdatedNotification;
use App\Notifications\OrderValidatedNotification;
use App\Notifications\SupplierValidationNotification;
use App\Services\WhatsApp\WhatsAppClient;
use App\Services\WhatsApp\WhatsAppMessage;
use App\Services\WhatsApp\WhatsAppResult;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Mail\Events\MessageSent;
use Illuminate\Support\Facades\Event;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\TestCase;

/** SCRUM-133 : notifications WhatsApp avec repli sur l'e-mail (R6). */
class WhatsAppTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Order $order;

    /** @var list<string> */
    private array $mails = [];

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->buyer()->create(['phone' => '+216 20 123 456']);
        $buyer = BuyerProfile::create(['user_id' => $this->user->id, 'organization' => 'Atelier', 'sector' => 'BTP']);
        $this->order = Order::create([
            'buyer_id' => $buyer->id,
            'supplier_id' => SupplierProfile::factory()->visible()->create()->id,
            'origin' => 'catalogue',
            'total' => 100,
            'status' => OrderStatus::SHIPPED,
        ]);

        Event::listen(MessageSent::class, function (MessageSent $event) {
            $this->mails[] = $event->message->getSubject();
        });
    }

    private function optIn(?User $user = null): void
    {
        ($user ?? $this->user)->forceFill(['whatsapp_opted_in_at' => now()])->save();
    }

    private function prefer(string $event, string $channel, bool $enabled): void
    {
        NotificationPreference::updateOrCreate(['user_id' => $this->user->id, 'event_type' => $event, 'channel' => $channel], ['enabled' => $enabled]);
    }

    private function notifyStatus(): void
    {
        $this->user->fresh()->notify(new OrderStatusUpdatedNotification($this->order));
    }

    private function fakeClient(?callable $behaviour = null): object
    {
        $client = new class($behaviour) implements WhatsAppClient
        {
            /** @var list<WhatsAppMessage> */
            public array $sent = [];

            public function __construct(private $behaviour) {}

            public function send(WhatsAppMessage $message): WhatsAppResult
            {
                if ($this->behaviour) {
                    ($this->behaviour)();
                }
                $this->sent[] = $message;

                return new WhatsAppResult(WhatsAppStatus::SENT, 'fake', 'msg-1');
            }
        };
        $this->app->instance(WhatsAppClient::class, $client);

        return $client;
    }

    // --- Consentement ---

    public function test_whatsapp_est_desactive_par_defaut(): void
    {
        $client = $this->fakeClient();
        $this->prefer('order_status_changed', 'whatsapp', true); // une case cochée ne remplace pas le consentement
        $this->notifyStatus();
        $this->assertSame([], $client->sent);

        $this->actingAs($this->user, 'sanctum')->getJson('/api/notifications/preferences')->assertOk()
            ->assertJsonPath('whatsapp.available', true)
            ->assertJsonPath('whatsapp.opted_in', false)
            ->assertJsonMissingPath('preferences.0.channels.whatsapp');
    }

    public function test_l_utilisateur_active_puis_retire_son_consentement(): void
    {
        $this->actingAs($this->user, 'sanctum')->putJson('/api/notifications/whatsapp', ['enabled' => true])->assertOk()
            ->assertJsonPath('whatsapp.active', true)
            ->assertJsonPath('whatsapp.simulated', true)
            ->assertJsonPath('whatsapp.phone', '+216 •• ••• 456');
        $this->assertNotNull($this->user->fresh()->whatsapp_opted_in_at);

        $this->putJson('/api/notifications/whatsapp', ['enabled' => false])->assertOk()->assertJsonPath('whatsapp.active', false);
        $this->assertNull($this->user->fresh()->whatsapp_opted_in_at);

        $this->putJson('/api/notifications/whatsapp', [])->assertJsonValidationErrors('enabled');
        $this->app['auth']->forgetGuards();
        $this->putJson('/api/notifications/whatsapp', ['enabled' => true])->assertUnauthorized();
    }

    /**
     * @return array<string, array{?string}>
     */
    public static function invalidPhones(): array
    {
        return ['absent' => [null], 'trop court' => ['+216 20 123'], 'étranger' => ['+33 612345678'], 'texte' => ['abc']];
    }

    #[DataProvider('invalidPhones')]
    public function test_un_numero_tunisien_valide_est_obligatoire(?string $phone): void
    {
        $this->user->update(['phone' => $phone]);

        $this->actingAs($this->user, 'sanctum')->putJson('/api/notifications/whatsapp', ['enabled' => true])->assertJsonValidationErrors('enabled');
        $this->getJson('/api/notifications/preferences')->assertJsonPath('whatsapp.phone', null);
    }

    public function test_changer_de_numero_retire_le_consentement_mais_pas_le_reformater(): void
    {
        $this->optIn();
        $this->user->update(['phone' => '+216 20123456']);
        $this->assertNotNull($this->user->fresh()->whatsapp_opted_in_at);

        $this->user->update(['phone' => '+216 99 999 999']);
        $this->assertNull($this->user->fresh()->whatsapp_opted_in_at);
    }

    // --- Préférences ---

    public function test_seuls_les_evenements_importants_sont_actifs_par_defaut(): void
    {
        $this->optIn();
        $rows = collect($this->actingAs($this->user, 'sanctum')->getJson('/api/notifications/preferences')->json('preferences'))->keyBy('event_type');

        // Liste de la story SCRUM-133, les autres événements restent au choix.
        $enabled = $rows->filter(fn ($row) => $row['channels']['whatsapp']['enabled'])->keys()->all();
        $this->assertEqualsCanonicalizing(['quote_received', 'order_validated', 'order_status_changed', 'dispute_decision'], $enabled);
        $this->assertFalse($rows['order_validated']['channels']['whatsapp']['locked']);
    }

    public function test_chaque_evenement_se_regle(): void
    {
        $this->optIn();
        $this->actingAs($this->user, 'sanctum')->putJson('/api/notifications/preferences', ['preferences' => [
            ['event_type' => 'order_status_changed', 'channel' => 'whatsapp', 'enabled' => true],
            ['event_type' => 'order_validated', 'channel' => 'whatsapp', 'enabled' => false],
        ]])->assertOk();

        $this->assertContains(WhatsAppChannel::class, (new OrderStatusUpdatedNotification($this->order))->via($this->user->fresh()));
        $this->assertNotContains(WhatsAppChannel::class, (new OrderValidatedNotification($this->order))->via($this->user->fresh()));
    }

    /** SCRUM-63 : ces notifications ignoraient les choix de l'utilisateur. */
    public function test_les_etapes_de_commande_et_la_validation_du_compte_respectent_les_preferences(): void
    {
        $this->prefer('order_status_changed', 'email', false);
        $this->assertSame(['database'], (new OrderStatusUpdatedNotification($this->order))->via($this->user));

        $this->prefer('account_validated', 'site', false);
        $this->prefer('account_validated', 'email', false);
        $notification = new SupplierValidationNotification(SupplierProfile::first(), ValidationStatus::VALIDATED);
        $this->assertSame(['mail'], $notification->via($this->user)); // e-mail critique
    }

    public function test_l_etape_annoncee_est_celle_de_l_evenement(): void
    {
        $notification = new OrderStatusUpdatedNotification($this->order);
        $this->order->update(['status' => OrderStatus::DELIVERED]);
        $restored = unserialize(serialize($notification)); // passage par la file d'attente

        $this->assertStringContainsString('expédiée', $restored->toArray($this->user)['title']);
        $this->assertStringContainsString('expédiée', $restored->toMail($this->user)->subject);
    }

    // --- Envoi ---

    public function test_un_envoi_reussi_ne_contient_que_le_titre_et_le_lien(): void
    {
        config(['app.frontend_url' => 'https://app.test']);
        $client = $this->fakeClient();
        $this->optIn();
        $this->prefer('order_status_changed', 'whatsapp', true);
        $this->prefer('order_status_changed', 'email', false);
        $this->notifyStatus();

        $this->assertCount(1, $client->sent);
        $this->assertSame('+21620123456', $client->sent[0]->to);
        $this->assertSame("Commande n° {$this->order->id} : expédiée", $client->sent[0]->title);
        $this->assertSame("https://app.test/orders/{$this->order->id}", $client->sent[0]->url);
        $this->assertSame([], $this->mails);

        $delivery = WhatsAppDelivery::sole();
        $this->assertSame([WhatsAppStatus::SENT, 'msg-1', false], [$delivery->status, $delivery->provider_message_id, $delivery->email_fallback]);
        $this->assertStringNotContainsString('20123456', json_encode($delivery->getAttributes()));
    }

    public function test_le_mode_simule_n_est_jamais_presente_comme_un_envoi(): void
    {
        $this->optIn();
        $this->prefer('order_status_changed', 'whatsapp', true);
        $this->notifyStatus();

        $this->assertSame(WhatsAppStatus::SIMULATED, WhatsAppDelivery::sole()->status);
        $this->actingAs($this->user, 'sanctum')->getJson('/api/notifications/preferences')
            ->assertJsonPath('whatsapp.recent.0.status', 'simulé')
            ->assertJsonPath('whatsapp.recent.0.event', "Changement d'étape d'une commande");
    }

    // --- Repli sur l'e-mail (R6) ---

    public function test_un_echec_envoie_l_e_mail_meme_desactive_pour_cet_evenement(): void
    {
        $this->fakeClient(fn () => throw new RuntimeException('Service indisponible'));
        $this->optIn();
        $this->prefer('order_status_changed', 'whatsapp', true);
        $this->prefer('order_status_changed', 'email', false);
        $this->notifyStatus();

        $this->assertCount(1, $this->mails);
        $delivery = WhatsAppDelivery::sole();
        $this->assertSame([WhatsAppStatus::FAILED, true, 'Service indisponible'], [$delivery->status, $delivery->email_fallback, $delivery->error]);
        $this->assertSame(1, $this->user->notifications()->count()); // pas de doublon dans le centre
    }

    public function test_un_echec_n_envoie_pas_deux_e_mails(): void
    {
        $this->fakeClient(fn () => throw new RuntimeException('Service indisponible'));
        $this->optIn();
        $this->prefer('order_status_changed', 'whatsapp', true);
        $this->notifyStatus();

        $this->assertCount(1, $this->mails);
        $this->assertFalse(WhatsAppDelivery::sole()->email_fallback);
    }

    public function test_une_notification_uniquement_whatsapp_n_est_jamais_perdue(): void
    {
        config(['whatsapp.simulate_failure' => true]);
        $this->optIn();
        foreach (['site' => false, 'email' => false, 'whatsapp' => true] as $channel => $enabled) {
            $this->prefer('order_status_changed', $channel, $enabled);
        }
        $this->notifyStatus();

        $this->assertSame(0, $this->user->notifications()->count());
        $this->assertCount(1, $this->mails);
    }

    public function test_un_consentement_retire_avant_l_envoi_est_respecte_et_replie_sur_l_e_mail(): void
    {
        $client = $this->fakeClient();
        $this->optIn();
        foreach (['site' => false, 'email' => false, 'whatsapp' => true] as $channel => $enabled) {
            $this->prefer('order_status_changed', $channel, $enabled);
        }
        $this->user->forceFill(['whatsapp_opted_in_at' => null])->save();

        // Le travail était déjà dans la file au moment du retrait
        app(WhatsAppChannel::class)->send($this->user, new OrderStatusUpdatedNotification($this->order));

        $this->assertSame([], $client->sent);
        $this->assertCount(1, $this->mails);
    }

    public function test_whatsapp_desactive_par_configuration(): void
    {
        $this->optIn();
        $this->prefer('order_status_changed', 'whatsapp', true);

        foreach (['disabled', 'inexistant'] as $provider) {
            config(['whatsapp.provider' => $provider]);
            $this->assertNotContains(WhatsAppChannel::class, (new OrderStatusUpdatedNotification($this->order))->via($this->user->fresh()));
            $this->actingAs($this->user, 'sanctum')->getJson('/api/notifications/preferences')
                ->assertJsonPath('whatsapp.available', false)
                ->assertJsonMissingPath('preferences.0.channels.whatsapp');
            $this->putJson('/api/notifications/whatsapp', ['enabled' => true])->assertStatus(422);
        }
        // Retirer son consentement reste toujours possible
        $this->putJson('/api/notifications/whatsapp', ['enabled' => false])->assertOk();
    }

    public function test_toutes_les_notifications_de_la_grille_savent_se_replier_sur_l_e_mail(): void
    {
        foreach (glob(app_path('Notifications/*.php')) as $file) {
            $class = 'App\\Notifications\\'.basename($file, '.php');

            if (in_array(RespectsNotificationPreferences::class, class_uses($class), true)) {
                $this->assertTrue(method_exists($class, 'toMail') && method_exists($class, 'toArray'), $class);
            }
        }
        $this->assertTrue(class_exists(DisputeDecidedNotification::class));
    }
}
