<?php

namespace App\Services\WhatsApp;

use App\Enums\WhatsAppStatus;

final readonly class WhatsAppResult
{
    public function __construct(
        public WhatsAppStatus $status,
        public string $provider,
        public ?string $messageId = null,
    ) {}
}
