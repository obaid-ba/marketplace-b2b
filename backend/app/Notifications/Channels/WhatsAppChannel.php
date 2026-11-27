<?php

namespace App\Notifications\Channels;

use App\Enums\WhatsAppStatus;
use App\Models\User;
use App\Models\WhatsAppDelivery;
use App\Services\WhatsApp\WhatsAppClient;
use App\Services\WhatsApp\WhatsAppMessage;
use App\Services\WhatsApp\WhatsAppSettings;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Notification as Notifier;
use Throwable;

/**
 * Canal WhatsApp (SCRUM-133). Règle R6 : si l'envoi échoue, l'e-mail part à la place,
 * même si l'utilisateur l'avait désactivé pour cet événement — sauf s'il part déjà.
 */
class WhatsAppChannel
{
    public function __construct(private readonly WhatsAppSettings $settings) {}

    public function send(object $notifiable, Notification $notification): void
    {
        if (! $notifiable instanceof User) {
            return;
        }

        $data = $notification->toArray($notifiable);
        $event = (string) ($data['event'] ?? 'notification');

        try {
            // Le consentement ou le numéro a pu changer depuis la mise en file.
            if (! $this->settings->canReceive($notifiable)) {
                throw new \RuntimeException('Destinataire non joignable sur WhatsApp.');
            }

            $result = app(WhatsAppClient::class)->send(new WhatsAppMessage(
                $this->settings->numberFor($notifiable),
                (string) ($data['title'] ?? 'Nouvelle notification'),
                rtrim((string) config('app.frontend_url'), '/').($data['url'] ?? ''),
            ));
        } catch (Throwable $e) {
            report($e);
            $this->fallBackToEmail($notifiable, $notification, $event, $e);

            return;
        }

        WhatsAppDelivery::create([
            'user_id' => $notifiable->id,
            'event_type' => $event,
            'status' => $result->status,
            'provider' => $result->provider,
            'provider_message_id' => $result->messageId,
        ]);
    }

    private function fallBackToEmail(User $user, Notification $notification, string $event, Throwable $cause): void
    {
        $alreadyMailed = in_array('mail', $notification->via($user), true);

        // Enregistré avant l'e-mail : la trace existe même si l'e-mail échoue à son tour.
        WhatsAppDelivery::create([
            'user_id' => $user->id,
            'event_type' => $event,
            'status' => WhatsAppStatus::FAILED,
            'email_fallback' => ! $alreadyMailed,
            'provider' => (string) config('whatsapp.provider'),
            'error' => mb_substr($cause->getMessage(), 0, 255),
        ]);

        if (! $alreadyMailed) {
            Notifier::sendNow($user, $notification, ['mail']);
        }
    }
}
