<?php

namespace App\Enums;

enum UserRole: string
{
    case Supplier = 'supplier';  // Fournisseur
    case Buyer = 'buyer';        // Porteur de projet
    case Admin = 'admin';        // Administrateur

    public function label(): string
    {
        return match ($this) {
            self::Supplier => 'Fournisseur',
            self::Buyer => 'Porteur de projet',
            self::Admin => 'Administrateur',
        };
    }
}
