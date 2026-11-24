<?php

namespace App\Services\Ai;

use App\Contracts\AiClient;

/**
 * Fournisseur d'IA simulé (SCRUM-80 / F25).
 *
 * Réponses déterministes, sans réseau ni clé API : c'est le mode par défaut
 * (`AI_PROVIDER=mock`) et celui des tests. Le texte produit est toujours une
 * proposition modifiable par l'utilisateur, jamais une décision automatique.
 */
class MockAiClient implements AiClient
{
    public function generate(string $feature, string $input, array $context = []): string
    {
        return match ($feature) {
            'tender_draft' => $this->tenderDraft($input, $context),
            'product_text' => $this->productText($input, $context),
            'quote_summary' => $this->quoteSummary($input, $context),
            default => trim($input) !== '' ? trim($input) : 'Aucune suggestion disponible.',
        };
    }

    /**
     * @param  array<string, mixed>  $context
     */
    private function tenderDraft(string $input, array $context): string
    {
        $need = trim($input) !== '' ? trim($input) : 'votre besoin';
        $category = $context['category'] ?? null;
        $region = $context['region'] ?? null;

        $lines = [
            "Objet : Consultation pour {$need}",
            '',
            'Description du besoin',
            "Nous recherchons un fournisseur capable de répondre à {$need}.",
        ];

        if ($category) {
            $lines[] = "Catégorie : {$category}.";
        }

        if ($region) {
            $lines[] = "Zone d'intervention : {$region}.";
        }

        $lines[] = '';
        $lines[] = 'Éléments attendus dans le devis : prix unitaire, délai de livraison, conditions de paiement et validité de l\'offre.';

        return implode("\n", $lines);
    }

    /**
     * @param  array<string, mixed>  $context
     */
    private function productText(string $input, array $context): string
    {
        $source = trim($input) !== '' ? trim($input) : 'Produit';
        $category = $context['category'] ?? null;

        $text = "{$source} — solution professionnelle";
        $text .= "\n\n".rtrim($source, '.').'.';

        if ($category) {
            $text .= " Conçu pour les besoins du secteur {$category}.";
        }

        $text .= ' Livraison rapide, qualité contrôlée et accompagnement par un fournisseur vérifié.';

        return $text;
    }

    /**
     * @param  array<string, mixed>  $context
     */
    private function quoteSummary(string $input, array $context): string
    {
        $quotes = $context['quotes'] ?? [];

        if (! is_array($quotes) || $quotes === []) {
            return "Aucun devis à comparer pour le moment.\n\nAide à la décision générée par IA.";
        }

        $lines = ['Synthèse des devis reçus', ''];

        foreach ($quotes as $index => $quote) {
            $supplier = $quote['supplier'] ?? 'Fournisseur';
            $amount = $quote['amount'] ?? '—';
            $delay = $quote['delivery_days'] ?? '—';
            $rating = $quote['rating_avg'] ?? null;

            $line = '- '.($index + 1).". {$supplier} : {$amount} TND, délai {$delay} jours";
            if ($rating !== null) {
                $line .= ", note {$rating}/5";
            }
            $lines[] = $line;
        }

        $lines[] = '';
        $lines[] = 'Comparez le prix, le délai et la note du fournisseur avant de choisir. La décision reste la vôtre.';
        $lines[] = '';
        $lines[] = 'Aide à la décision générée par IA.';

        return implode("\n", $lines);
    }
}
