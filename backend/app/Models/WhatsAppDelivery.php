<?php

namespace App\Models;

use App\Enums\WhatsAppStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Trace d'un envoi WhatsApp (SCRUM-133), sans numéro ni contenu.
 */
class WhatsAppDelivery extends Model
{
    protected $table = 'whatsapp_deliveries';

    /**
     * @var list<string>
     */
    protected $fillable = ['user_id', 'event_type', 'status', 'email_fallback', 'provider', 'provider_message_id', 'error'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => WhatsAppStatus::class,
            'email_fallback' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
