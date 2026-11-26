<?php

namespace Tests\Feature\Notification;

use App\Models\NotificationPreference;
use App\Models\User;
use App\Notifications\TenderReceivedNotification;
use App\Models\Tender;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Centre de notifications et préférences par événement / canal (SCRUM-62, SCRUM-63).
 */
class NotificationCenterTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->buyer()->create();
        $this->user->buyerProfile()->create(['organization' => 'Acheteur']);

        Sanctum::actingAs($this->user);
    }

    public function test_le_centre_liste_les_notifications_et_le_compteur_de_non_lues(): void
    {
        $this->notification('Première notification');
        $this->notification('Deuxième notification', read: true);

        $this->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.title', 'Première notification');
        $this->getJson('/api/notifications/unread-count')
            ->assertOk()
            ->assertJsonPath('count', 1);
    }

    public function test_marquer_une_notification_comme_lue_puis_tout_marquer_comme_lu(): void
    {
        $first = $this->notification('Première');
        $this->notification('Deuxième');

        $this->postJson("/api/notifications/{$first->id}/read")
            ->assertOk()
            ->assertJsonPath('unread_count', 1);

        $this->assertNotNull($first->refresh()->read_at);

        $this->postJson('/api/notifications/read-all')
            ->assertOk()
            ->assertJsonPath('unread_count', 0);

        $this->assertSame(0, $this->user->unreadNotifications()->count());
    }

    public function test_une_notification_d_un_autre_utilisateur_est_introuvable(): void
    {
        $other = User::factory()->buyer()->create();
        $notification = $other->notifications()->create([
            'id' => Str::uuid()->toString(),
            'type' => 'App\\Notifications\\Test',
            'data' => ['title' => 'Privée'],
        ]);

        $this->postJson("/api/notifications/{$notification->id}/read")->assertNotFound();
    }

    public function test_la_grille_des_preferences_est_complete_et_les_emails_critiques_sont_verrouilles(): void
    {
        $response = $this->getJson('/api/notifications/preferences')->assertOk();

        $preferences = collect($response->json('preferences'))->keyBy('event_type');

        $this->assertTrue($preferences->has(NotificationPreference::EVENT_TENDER_RECEIVED));
        $this->assertTrue($preferences->has(NotificationPreference::EVENT_ORDER_VALIDATED));

        $this->assertFalse($preferences[NotificationPreference::EVENT_TENDER_RECEIVED]['critical_email']);
        $this->assertFalse($preferences[NotificationPreference::EVENT_TENDER_RECEIVED]['channels']['email']['locked']);

        $this->assertTrue($preferences[NotificationPreference::EVENT_ORDER_VALIDATED]['critical_email']);
        $this->assertTrue($preferences[NotificationPreference::EVENT_ORDER_VALIDATED]['channels']['email']['locked']);
        $this->assertTrue($preferences[NotificationPreference::EVENT_ORDER_VALIDATED]['channels']['email']['enabled']);
    }

    public function test_le_porteur_desactive_un_canal_mais_pas_un_email_critique(): void
    {
        $this->putJson('/api/notifications/preferences', [
            'preferences' => [
                [
                    'event_type' => NotificationPreference::EVENT_TENDER_RECEIVED,
                    'channel' => NotificationPreference::CHANNEL_EMAIL,
                    'enabled' => false,
                ],
                [
                    'event_type' => NotificationPreference::EVENT_ORDER_VALIDATED,
                    'channel' => NotificationPreference::CHANNEL_EMAIL,
                    'enabled' => false,
                ],
                [
                    'event_type' => NotificationPreference::EVENT_TENDER_RECEIVED,
                    'channel' => NotificationPreference::CHANNEL_SITE,
                    'enabled' => false,
                ],
            ],
        ])->assertOk();

        $this->assertDatabaseHas('notification_preferences', [
            'user_id' => $this->user->id,
            'event_type' => NotificationPreference::EVENT_TENDER_RECEIVED,
            'channel' => NotificationPreference::CHANNEL_EMAIL,
            'enabled' => false,
        ]);

        // L'e-mail critique reste enregistré activé, même si l'interface envoie false.
        $this->assertDatabaseHas('notification_preferences', [
            'user_id' => $this->user->id,
            'event_type' => NotificationPreference::EVENT_ORDER_VALIDATED,
            'channel' => NotificationPreference::CHANNEL_EMAIL,
            'enabled' => true,
        ]);

        $this->assertTrue(NotificationPreference::allows(
            $this->user,
            NotificationPreference::EVENT_TENDER_RECEIVED,
            NotificationPreference::CHANNEL_EMAIL,
        ) === false);

        $this->assertTrue(NotificationPreference::allows(
            $this->user,
            NotificationPreference::EVENT_ORDER_VALIDATED,
            NotificationPreference::CHANNEL_EMAIL,
        ));
    }

    private function notification(string $title, bool $read = false): object
    {
        return $this->user->notifications()->create([
            'id' => Str::uuid()->toString(),
            'type' => 'App\\Notifications\\Test',
            'data' => [
                'event' => NotificationPreference::EVENT_TENDER_RECEIVED,
                'title' => $title,
                'message' => 'Message de test',
                'url' => '/porteur/demandes',
            ],
            'read_at' => $read ? now() : null,
            'created_at' => $read ? now()->subMinute() : now(),
        ]);
    }
}
