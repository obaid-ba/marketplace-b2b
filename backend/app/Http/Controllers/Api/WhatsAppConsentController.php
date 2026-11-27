<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\NotificationPreference;
use App\Services\WhatsApp\WhatsAppSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Consentement aux notifications WhatsApp (SCRUM-133) : désactivées par défaut, retirable à tout moment.
 */
class WhatsAppConsentController extends Controller
{
    public function update(Request $request, WhatsAppSettings $settings): JsonResponse
    {
        $enabled = $request->validate(['enabled' => ['required', 'boolean']])['enabled'];
        $user = $request->user();

        if ($enabled && ! $settings->isAvailable()) {
            throw ValidationException::withMessages(['enabled' => "WhatsApp n'est pas disponible pour le moment."]);
        }

        if ($enabled && $settings->numberFor($user) === null) {
            throw ValidationException::withMessages(['enabled' => 'Ajoutez un numéro de téléphone tunisien valide (+216) à votre compte.']);
        }

        $user->forceFill(['whatsapp_opted_in_at' => $enabled ? ($user->whatsapp_opted_in_at ?? now()) : null])->save();

        return response()->json([
            'message' => $enabled ? 'Notifications WhatsApp activées.' : 'Notifications WhatsApp désactivées.',
            'preferences' => NotificationPreference::gridFor($user),
            'whatsapp' => NotificationPreferenceController::whatsappState($user),
        ]);
    }
}
