<?php

namespace App\Enums;

enum QuoteStatus: string
{
    case SENT = 'envoyé';
    case IN_NEGOTIATION = 'en négociation';
    case ACCEPTED = 'accepté';
    case REJECTED = 'refusé';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}