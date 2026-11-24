<?php

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;

/**
 * Une notification vient d'être ajoutée au centre de l'utilisateur (SCRUM-62) : la cloche se met à jour.
 */
class NotificationCreated implements ShouldBroadcastNow
{
    public function __construct(public int $userId, public string $notificationId) {}

    /**
     * @return list<PrivateChannel>
     */
    public function broadcastOn(): array
    {
        return [new PrivateChannel("user.{$this->userId}")];
    }

    public function broadcastAs(): string
    {
        return 'notification.created';
    }

    /**
     * @return array<string, string>
     */
    public function broadcastWith(): array
    {
        return ['notification_id' => $this->notificationId];
    }
}
