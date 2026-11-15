<?php

namespace App\Enums;

enum ValidationStatus: string
{
    case PENDING = 'en attente';
    case VALIDATED = 'validé';
    case REJECTED = 'refusé';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}