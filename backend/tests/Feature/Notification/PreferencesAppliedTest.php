<?php

namespace Tests\Feature\Notification;

use App\Enums\OrderStatus;
use App\Enums\ReviewStatus;
use App\Models\BuyerProfile;
use App\Models\NotificationPreference;
use App\Models\Order;
use App\Models\Product;
use App\Models\Review;
use App\Models\SupplierProfile;
use App\Models\User;
use App\Notifications\Channels\WhatsAppChannel;
use App\Notifications\NewOrderNotification;
use App\Notifications\OrderClosedNotification;
use App\Notifications\ProductWithdrawnNotification;
use App\Notifications\ReviewModeratedNotification;
use App\Notifications\ReviewReplyNotification;
use App\Notifications\ReviewSubmittedNotification;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** SCRUM-63 / SCRUM-133 : commandes directes, annonces et avis respectent les préférences, en file d'attente. */
class PreferencesAppliedTest extends TestCase
{
    use RefreshDatabase;

    public function test_chaque_notification_suit_les_preferences_de_son_evenement(): void
    {
        $supplier = SupplierProfile::factory()->visible()->create();
        $user = $supplier->user;
        $user->forceFill(['phone' => '+216 20 123 456', 'whatsapp_opted_in_at' => now()])->save();
        $buyer = BuyerProfile::create(['user_id' => User::factory()->buyer()->create()->id, 'organization' => 'Atelier', 'sector' => 'BTP']);
        $order = Order::create(['buyer_id' => $buyer->id, 'supplier_id' => $supplier->id, 'origin' => 'catalogue', 'total' => 100, 'status' => OrderStatus::VALIDATED]);
        $review = Review::create(['order_id' => $order->id, 'buyer_id' => $buyer->id, 'supplier_id' => $supplier->id, 'rating' => 2, 'status' => ReviewStatus::PUBLISHED]);
        $product = Product::factory()->for($supplier, 'supplier')->create();

        $cases = [
            [new NewOrderNotification($order), NotificationPreference::EVENT_ORDER_VALIDATED, true],
            [new OrderClosedNotification($order), NotificationPreference::EVENT_ORDER_STATUS, true],
            [new ProductWithdrawnNotification($product, 'Motif'), NotificationPreference::EVENT_ANNOUNCEMENT_REMOVED, false],
            [new ReviewSubmittedNotification($review), NotificationPreference::EVENT_REVIEW, false],
            [new ReviewReplyNotification($review), NotificationPreference::EVENT_REVIEW, false],
            [new ReviewModeratedNotification($review, 'masqué'), NotificationPreference::EVENT_REVIEW, false],
        ];

        foreach ($cases as [$notification, $event, $whatsApp]) {
            $this->assertInstanceOf(ShouldQueue::class, $notification);
            $this->assertSame($whatsApp, in_array(WhatsAppChannel::class, $notification->via($user), true), $notification::class);
            $this->assertContains('mail', $notification->via($user));
            $this->assertSame($event, $notification->toArray($user)['event']);
            $this->assertNotEmpty($notification->toArray($user)['title']);

            foreach (['email', 'whatsapp'] as $channel) {
                NotificationPreference::updateOrCreate(['user_id' => $user->id, 'event_type' => $event, 'channel' => $channel], ['enabled' => false]);
            }

            // Commande validée : e-mail critique, toujours envoyé.
            $expected = $event === NotificationPreference::EVENT_ORDER_VALIDATED ? ['database', 'mail'] : ['database'];
            $this->assertSame($expected, $notification->via($user), $notification::class);
            NotificationPreference::query()->delete();
        }
    }
}
