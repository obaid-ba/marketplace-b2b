<?php

namespace App\Enums;

enum TenderStatus: string
{
    case OPEN = 'ouverte';
    case IN_NEGOTIATION = 'en négociation';
    case CLOSED = 'clôturée';
    case CANCELLED = 'annulée';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
