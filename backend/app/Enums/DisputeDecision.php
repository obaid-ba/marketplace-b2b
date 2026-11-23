<?php

namespace App\Enums;

/** Décision de l'administrateur. Elle est enregistrée et notifiée ; aucun remboursement n'est déclenché par l'application. */
enum DisputeDecision: string
{
    case FULL_REFUND = 'Remboursement total';
    case PARTIAL_REFUND = 'Remboursement partiel';
    case REPLACEMENT = 'Remplacement du produit';
    case REJECTED = 'Réclamation rejetée';

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
