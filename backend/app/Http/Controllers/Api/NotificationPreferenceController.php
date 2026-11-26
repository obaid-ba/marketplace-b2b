<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Notification\UpdateNotificationPreferencesRequest;
use App\Models\NotificationPreference;
use App\Models\User;
use App\Models\WhatsAppDelivery;
use App\Services\WhatsApp\WhatsAppSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Préférences de notification : un réglage par événement et par canal (SCRUM-63 / F15).
 * Les e-mails critiques restent actifs côté serveur, même si l'interface les envoie à false.
 */
class NotificationPreferenceController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        return response()->json([
            'preferences' => NotificationPreference::gridFor($request->user()),
            'whatsapp' => self::whatsappState($request->user()),
        ]);
    }

    public function update(UpdateNotificationPreferencesRequest $request): JsonResponse
    {
        $user = $request->user();

        foreach ($request->validated('preferences') as $preference) {
            if (
                $preference['channel'] === NotificationPreference::CHANNEL_EMAIL
                && NotificationPreference::isCriticalEmail($preference['event_type'])
            ) {
                $preference['enabled'] = true;
            }

            NotificationPreference::query()->updateOrCreate(
                [
                    'user_id' => $user->id,
                    'event_type' => $preference['event_type'],
                    'channel' => $preference['channel'],
                ],
                ['enabled' => (bool) $preference['enabled']],
            );
        }

        return response()->json([
            'message' => 'Préférences enregistrées.',
            'preferences' => NotificationPreference::gridFor($user->refresh()),
            'whatsapp' => self::whatsappState($user),
        ]);
    }

    /**
     * État de WhatsApp pour l'utilisateur (SCRUM-133). Le numéro n'est affiché que masqué.
     *
     * @return array<string, mixed>
     */
    public static function whatsappState(User $user): array
    {
        $settings = app(WhatsAppSettings::class);

        return [
            'available' => $settings->isAvailable(),
            'simulated' => $settings->isSimulated(),
            'opted_in' => $user->whatsapp_opted_in_at !== null,
            'active' => $settings->canReceive($user),
            'phone' => $settings->maskedNumberFor($user),
            'recent' => WhatsAppDelivery::query()->where('user_id', $user->id)->latest('id')->limit(5)->get()
                ->map(fn (WhatsAppDelivery $delivery) => [
                    'id' => $delivery->id,
                    'event' => NotificationPreference::EVENTS[$delivery->event_type] ?? 'Notification',
                    'status' => $delivery->status->value,
                    'email_fallback' => $delivery->email_fallback,
                    'created_at' => $delivery->created_at?->toIso8601String(),
                ])->all(),
        ];
    }
}
