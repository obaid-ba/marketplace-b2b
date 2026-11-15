<?php

namespace App\Enums;

enum DisputeStatus: string
{
    case OPEN = 'ouvert';
    case IN_PROGRESS = 'en cours';
    case DECIDED = 'décidé';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
