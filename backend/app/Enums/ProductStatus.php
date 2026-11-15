<?php

namespace App\Enums;

enum ProductStatus: string
{
    case DRAFT = 'brouillon';
    case PUBLISHED = 'publié';
    case WITHDRAWN = 'retiré';

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}