<?php

namespace App\Enums;

/** Motif d'un litige. La valeur enregistrée est le libellé affiché (tableau de bord admin, e-mails). */
enum DisputeReason: string
{
    case NOT_RECEIVED = 'Commande non reçue';
    case DAMAGED = 'Produit endommagé';
    case NOT_CONFORM = 'Produit non conforme';
    case INCOMPLETE = 'Commande incomplète';
    case OTHER = 'Autre problème';

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
