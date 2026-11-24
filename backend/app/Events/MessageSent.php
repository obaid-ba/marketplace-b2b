<?php

namespace App\Events;

use App\Models\Message;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

/**
 * Nouveau message (SCRUM-60). Seuls les identifiants sont diffusés : le contenu est ensuite lu
 * par l'API, qui vérifie les droits et n'a pas de limite de taille.
 */
class MessageSent implements ShouldBroadcastNow
{
    public function __construct(public Message $message) {}

    /**
     * @return list<PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return $this->message->conversation->participants()->pluck('user_id')
            ->map(fn (int $userId) => new PrivateChannel("user.{$userId}"))
            ->all();
    }

    public function broadcastAs(): string
    {
        return 'message.sent';
    }

    /**
     * @return array<string, int>
     */
    public function broadcastWith(): array
    {
        return [
            'conversation_id' => $this->message->conversation_id,
            'message_id' => $this->message->id,
            'sender_id' => $this->message->sender_id,
        ];
    }
}
