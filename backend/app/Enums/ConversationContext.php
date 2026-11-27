<?php

namespace App\Enums;

/** Contexte d'une conversation (colonne conversations.context_type). */
enum ConversationContext: string
{
    case TENDER = 'demande';
    case QUOTE = 'devis';
    case ORDER = 'commande';
    case DIRECT = 'direct';

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
