<?php

namespace App\Http\Requests\Notification;

use App\Models\NotificationPreference;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Mise à jour de la grille des préférences de notification (SCRUM-63).
 */
class UpdateNotificationPreferencesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'preferences' => ['required', 'array', 'min:1'],
            'preferences.*.event_type' => ['required', 'string', Rule::in(array_keys(NotificationPreference::EVENTS))],
            'preferences.*.channel' => ['required', 'string', Rule::in([
                NotificationPreference::CHANNEL_SITE,
                NotificationPreference::CHANNEL_EMAIL,
            ])],
            'preferences.*.enabled' => ['required', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'preferences.required' => 'Aucune préférence à enregistrer.',
            'preferences.*.event_type.in' => 'Type d’événement inconnu.',
            'preferences.*.channel.in' => 'Canal de notification inconnu.',
        ];
    }
}
