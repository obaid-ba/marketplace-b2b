<?php

namespace App\Enums;

enum AnomalyStatus: string
{
    case NEW = 'nouvelle';
    case HANDLED = 'traitée';
    case IGNORED = 'ignorée';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
