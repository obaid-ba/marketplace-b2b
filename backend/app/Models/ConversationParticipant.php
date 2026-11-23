<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Participant d'une conversation et dernier message qu'il a lu (compteur de non lus, SCRUM-59).
 */
class ConversationParticipant extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = ['conversation_id', 'user_id', 'last_read_at', 'last_read_message_id'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return ['last_read_at' => 'datetime'];
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
