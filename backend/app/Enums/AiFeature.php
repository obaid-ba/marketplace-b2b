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
    // S7 : détection des avis et annonces suspects (SCRUM-84), comportements inhabituels (SCRUM-86).
    case MODERATION = 'modération';
    case RECOMMENDATION = 'recommandation';
}
