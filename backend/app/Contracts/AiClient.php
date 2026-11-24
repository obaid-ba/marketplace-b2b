<?php

namespace App\Contracts;

/**
 * Contrat commun à tous les fournisseurs d'IA (SCRUM-80 / F25).
 *
 * Les fonctionnalités IA (brouillon de demande, texte produit, résumé de
 * devis) passent par ce contrat : changer de fournisseur ne touche ni les
 * contrôleurs ni les tests. Le mode `mock` (voir MockAiClient) est utilisé
 * hors ligne et dans les tests.
 */
interface AiClient
{
    /**
     * Génère un texte pour une fonctionnalité donnée.
     *
     * @param  string  $feature  identifiant de la fonctionnalité (`tender_draft`, `product_text`, `quote_summary`)
     * @param  string  $input  texte saisi par l'utilisateur
     * @param  array<string, mixed>  $context  données complémentaires (catégorie, devis, produit…)
     */
    public function generate(string $feature, string $input, array $context = []): string;
}
