<?php

namespace App\Enums;

/** Fonctionnalités IA (docs/ENTITIES.md, AIInteraction). */
enum AiFeature: string
{
    case WRITING = 'rédaction';
    case REWRITING = 'reformulation';
    case MATCHING = 'matching';
    case QUOTE_SUMMARY = 'résumé de devis';
    case PRICE_ESTIMATE = 'estimation de prix';
    case SENTIMENT = 'sentiment';
    case CHATBOT = 'chatbot';
}
