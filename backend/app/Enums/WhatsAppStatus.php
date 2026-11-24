<?php

namespace App\Enums;

enum WhatsAppStatus: string
{
    case SENT = 'envoyé';
    case SIMULATED = 'simulé';
    case FAILED = 'échoué';
}
