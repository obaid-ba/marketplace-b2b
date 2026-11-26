<?php

namespace App\Events;

use App\Models\Conversation;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

/**
 * Un participant a lu la conversation : accusé « Lu » chez l'autre, compteurs à jour sur ses autres onglets.
 */
class ConversationRead implements ShouldBroadcastNow
{
    public function __construct(
        public Conversation $conversation,
        public int $readerId,
        public int $lastReadMessageId,
    ) {}

    /**
     * @return list<PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return $this->conversation->participants()->pluck('user_id')
            ->map(fn (int $userId) => new PrivateChannel("user.{$userId}"))
            ->all();
    }

    public function broadcastAs(): string
    {
        return 'conversation.read';
    }

    /**
     * @return array<string, int>
     */
    public function broadcastWith(): array
    {
        return [
            'conversation_id' => $this->conversation->id,
            'reader_id' => $this->readerId,
            'last_read_message_id' => $this->lastReadMessageId,
        ];
    }
}
