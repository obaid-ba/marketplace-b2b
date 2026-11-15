<?php

namespace App\Enums;

enum ReviewStatus: string
{
    case PUBLISHED = 'publié';
    case REPORTED = 'signalé';
    case HIDDEN = 'masqué';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
