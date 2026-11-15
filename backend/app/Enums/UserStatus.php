<?php

namespace App\Enums;

enum UserStatus: string
{
    case EMAIL_TO_VERIFY = 'e-mail à vérifier';
    case ACTIVE = 'actif';
    case SUSPENDED = 'suspendu';
    case DEACTIVATED = 'désactivé';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
