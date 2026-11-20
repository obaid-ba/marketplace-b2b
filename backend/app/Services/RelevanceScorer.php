<?php

namespace App\Services;

use App\Models\SupplierProfile;
use App\Models\Tender;

/**
 * Score de pertinence v1, sans IA générative (SCRUM-50 / F12).
 *
 * Trois signaux suffisent pour classer les demandes chez les bons fournisseurs :
 * - la catégorie du besoin (50 points) ;
 * - la région souhaitée, siège ou zone de couverture (30 points) ;
 * - les mots-clés communs entre la demande et le fournisseur (20 points maximum).
 */
class RelevanceScorer
{
    private const STOP_WORDS = [
        'alors', ' aussi', 'autre', 'avec', 'avoir', 'beaucoup', 'bien', 'cela', 'cent',
        'certain', 'chez', 'comme', 'comment', 'dans', 'demande', 'depuis', 'des', 'devis',
        'doit', 'donc', 'dont', 'elle', 'encore', 'entre', 'être', 'faire', 'faut', 'fournir',
        'fournisseur', 'grand', 'leur', 'lors', 'mais', 'même', 'merci', 'moins', 'notre',
        'nous', 'para', 'partir', 'plus', 'pour', 'pouvoir', 'premier', 'produit', 'projet',
        'quand', 'quel', 'quelle', 'sans', 'selon', 'sera', 'seront', 'ses', 'sont', 'sous',
        'sur', 'tout', 'tous', 'toute', 'toutes', 'travail', 'très', 'une', 'vers', 'voir',
        'votre', 'vous', 'avec', 'dans', 'pour', 'les', 'des', 'est', 'sont', 'que', 'qui',
    ];

    public function score(Tender $tender, SupplierProfile $supplier): float
    {
        $supplier->loadMissing(['categories:id,name', 'coverageRegions:id', 'region:id']);

        $score = 0.0;
        $categoryIds = $supplier->categories->pluck('id')->all();

        if (in_array($tender->category_id, $categoryIds, true)) {
            $score += 50;
        }

        if ($tender->region_id === null) {
            // Demande nationale : tous les fournisseurs de la catégorie sont concernés.
            $score += 15;
        } elseif ((int) $supplier->region_id === (int) $tender->region_id) {
            $score += 30;
        } elseif ($supplier->coverageRegions->contains('id', $tender->region_id)) {
            $score += 25;
        }

        $tenderKeywords = $this->keywords(implode(' ', array_filter([
            $tender->title,
            $tender->description,
            is_array($tender->ai_keywords) ? implode(' ', $tender->ai_keywords) : '',
            $tender->relationLoaded('category') ? $tender->category?->name : '',
        ])));

        $supplierKeywords = $this->keywords(implode(' ', array_filter([
            $supplier->company_name,
            $supplier->description,
            $supplier->sector,
            $supplier->categories->pluck('name')->implode(' '),
        ])));

        $common = array_intersect($tenderKeywords, $supplierKeywords);
        $score += min(20, count($common) * 4);

        return round(min(100.0, $score), 2);
    }

    /**
     * Mots significatifs d'un texte (minuscules, sans ponctuation ni mots vides).
     *
     * @return list<string>
     */
    public function keywords(string $text): array
    {
        $text = mb_strtolower($text);
        $text = (string) preg_replace('/[^\p{L}\p{N}\s]+/u', ' ', $text);
        $words = preg_split('/\s+/u', $text, -1, PREG_SPLIT_NO_EMPTY) ?: [];

        $words = array_filter(
            $words,
            fn (string $word) => mb_strlen($word) >= 4 && ! in_array($word, self::STOP_WORDS, true),
        );

        return array_values(array_unique($words));
    }
}
