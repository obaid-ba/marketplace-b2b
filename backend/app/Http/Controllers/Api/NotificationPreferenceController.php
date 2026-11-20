<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Notification\UpdateNotificationPreferencesRequest;
use App\Models\NotificationPreference;
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
        ]);
    }
}
