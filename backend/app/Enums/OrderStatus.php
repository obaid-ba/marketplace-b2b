<?php

namespace App\Enums;

enum OrderStatus: string
{
    case VALIDATED = 'validée';
    case IN_PREPARATION = 'en préparation';
    case IN_DELIVERY = 'en livraison';
    case DELIVERED = 'livrée';
    case CLOSED = 'clôturée';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
