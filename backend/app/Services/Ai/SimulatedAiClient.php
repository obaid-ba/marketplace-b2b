<?php

namespace App\Services\Ai;

use App\Enums\AiFeature;
use App\Exceptions\AiUnavailableException;
use Illuminate\Support\Str;

/**
 * Mode simulé : des règles de calcul, sans appel extérieur ni clé. Le résultat est déterministe et
 * toujours présenté à l'utilisateur comme simulé, jamais comme une réponse d'IA.
 */
class SimulatedAiClient implements AiClient
{
    public const NAME = 'simulated';

    public function generate(AiRequest $request): AiResponse
    {
        $data = match ($request->feature) {
            AiFeature::QUOTE_SUMMARY => $this->quoteSummary($request->data),
            AiFeature::WRITING => ['text' => $request->data['type'] === 'tender'
                ? $this->tenderDraft($request->data)
                : $this->productText($request->data)],
            AiFeature::REWRITING => ['text' => $this->rephrase($request->data['text'])],
            AiFeature::MATCHING => $this->tenderAnalysis($request->data),
            AiFeature::PRICE_ESTIMATE => $this->priceEstimate($request->data),
            AiFeature::SENTIMENT => $request->data['type'] === 'review'
                ? $this->reviewAnalysis($request->data)
                : $this->supplierReviewSummary($request->data),
            AiFeature::MODERATION => $this->productModeration($request->data),
            AiFeature::CHATBOT => $this->chatbot($request->data),
            default => throw new AiUnavailableException("Le mode simulé ne couvre pas « {$request->feature->value} »."),
        };

        return new AiResponse($data, self::NAME);
    }

    /**
     * @param  array{tender: array<string, mixed>, quotes: list<array<string, mixed>>}  $data
     * @return array<string, mixed>
     */
    private function quoteSummary(array $data): array
    {
        $tender = $data['tender'];
        $quotes = collect($data['quotes']);
        $lowest = $quotes->min('amount');
        $highest = $quotes->max('amount');
        $fastest = $quotes->min('delivery_days');
        $bestRating = $quotes->where('reviews_count', '>', 0)->max('rating');

        $analysed = $quotes->map(function (array $quote) use ($tender, $lowest, $fastest, $bestRating, $quotes) {
            $strengths = $concerns = $questions = [];
            $severalPrices = $quotes->pluck('amount')->unique()->count() > 1;
            $severalDelays = $quotes->pluck('delivery_days')->unique()->count() > 1;

            if ($severalPrices && $quote['amount'] === $lowest) {
                $strengths[] = 'Prix le plus bas.';
            } elseif ($lowest > 0 && $quote['amount'] > $lowest) {
                $gap = (int) round(($quote['amount'] - $lowest) / $lowest * 100);
                if ($gap >= 10) {
                    $concerns[] = "Prix supérieur de {$gap} % au devis le moins cher.";
                }
            }

            if ($severalDelays && $quote['delivery_days'] === $fastest) {
                $strengths[] = "Délai le plus court ({$this->days($quote['delivery_days'])}).";
            }
            if ($tender['days_until_deadline'] !== null && $quote['delivery_days'] > $tender['days_until_deadline']) {
                $concerns[] = 'Livraison annoncée après la date souhaitée.';
            }
            if ($tender['budget'] !== null && $quote['amount'] > $tender['budget']) {
                $concerns[] = 'Montant au-dessus du budget indicatif.';
            }

            if ($quote['reviews_count'] === 0) {
                $concerns[] = 'Fournisseur pas encore noté.';
            } elseif ($quote['rating'] === $bestRating && $quote['rating'] >= 4) {
                $strengths[] = 'Meilleure note : '.$this->decimal($quote['rating']).' / 5 ('.$quote['reviews_count'].' avis).';
            } elseif ($quote['rating'] < 3) {
                $concerns[] = 'Note faible : '.$this->decimal($quote['rating']).' / 5.';
            }

            if (blank($quote['conditions'])) {
                $questions[] = 'Quelles sont les conditions de paiement et de garantie ?';
            }
            if ($tender['days_until_deadline'] !== null && $quote['delivery_days'] > $tender['days_until_deadline']) {
                $questions[] = 'Une livraison avant la date souhaitée est-elle possible ?';
            }

            return [
                'quote_id' => $quote['quote_id'],
                'strengths' => $strengths,
                'concerns' => $concerns,
                'questions' => $questions,
            ];
        });

        $count = $quotes->count();
        $summary = "{$count} devis à comparer, ".($lowest === $highest
            ? "tous à {$this->money($lowest)}."
            : "de {$this->money($lowest)} à {$this->money($highest)}.");
        $summary .= ' Délais : '.($fastest === $quotes->max('delivery_days')
            ? "{$this->days($fastest)} pour tous."
            : "de {$this->days($fastest)} à {$this->days($quotes->max('delivery_days'))}.");

        $withoutConditions = $quotes->filter(fn (array $quote) => blank($quote['conditions']))->count();
        if ($withoutConditions > 0) {
            $summary .= $withoutConditions === 1
                ? ' Un devis ne précise pas ses conditions.'
                : " {$withoutConditions} devis ne précisent pas leurs conditions.";
        }

        return ['summary' => $summary, 'quotes' => $analysed->values()->all()];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function tenderDraft(array $data): string
    {
        return implode("\n", array_filter([
            'Objet : '.($data['title'] ?: "consultation pour {$data['text']}"),
            '',
            'Description du besoin',
            "Nous recherchons un fournisseur capable de répondre au besoin suivant : {$data['text']}.",
            $data['category'] ? "Catégorie : {$data['category']}." : null,
            $data['region'] ? "Zone d'intervention : {$data['region']}." : null,
            '',
            "Éléments attendus dans le devis : prix unitaire, délai de livraison, conditions de paiement et validité de l'offre.",
        ], fn (?string $line) => $line !== null));
    }

    /**
     * Met en forme les notes du fournisseur, sans ajouter de qualité ou de promesse qu'il n'a pas écrite.
     *
     * @param  array<string, mixed>  $data
     */
    private function productText(array $data): string
    {
        $text = $this->rephrase($data['text']);

        return $data['category'] ? "{$text}\n\nCatégorie : {$data['category']}." : $text;
    }

    /**
     * Catégorie et mots-clés d'une demande (SCRUM-81) : mots communs entre le texte et le vocabulaire de chaque
     * catégorie (son nom compte triple, puis les titres des produits qui y sont publiés).
     *
     * @param  array{text: string, categories: list<array{id: int, name: string, parent: ?string, terms: list<string>}>}  $data
     * @return array{category_id: ?int, keywords: list<string>, confidence: int}
     */
    private function tenderAnalysis(array $data): array
    {
        $words = $this->words($data['text']);
        $stems = array_unique(array_map(fn (string $word) => $this->stem($word), $words));
        $best = null;

        foreach ($data['categories'] as $category) {
            $score = 3 * count(array_intersect($stems, $this->stems($category['name'])))
                + count(array_intersect($stems, $this->stems(implode(' ', $category['terms']))));

            // À score égal, la sous-catégorie (plus précise) l'emporte sur la catégorie principale.
            $rank = [$score, $category['parent'] !== null ? 1 : 0, -$category['id']];

            if ($score > 0 && ($best === null || $rank > $best['rank'])) {
                $best = ['id' => $category['id'], 'score' => $score, 'rank' => $rank];
            }
        }

        // Mots les plus fréquents de la demande, dans leur ordre d'apparition.
        $counts = array_count_values($words);
        $keywords = array_keys($counts);
        usort($keywords, fn (string $a, string $b) => $counts[$b] <=> $counts[$a]);

        return [
            'category_id' => $best['id'] ?? null,
            'keywords' => array_slice($keywords, 0, 8),
            'confidence' => $best === null ? 0 : min(95, 40 + 10 * $best['score']),
        ];
    }

    /**
     * Fourchette de prix (SCRUM-82) : quartiles des montants des transactions comparables.
     *
     * @param  array{amounts: list<float>}  $data
     * @return array{low: float, median: float, high: float, comment: string}
     */
    private function priceEstimate(array $data): array
    {
        $amounts = $data['amounts'];
        sort($amounts);

        $low = $this->quantile($amounts, 0.25);
        $high = $this->quantile($amounts, 0.75);
        $count = count($amounts);

        return [
            'low' => round($low, 2),
            'median' => round($this->quantile($amounts, 0.5), 2),
            'high' => round($high, 2),
            'comment' => "La moitié des {$count} transactions comparables se situe entre {$this->money($low)} et {$this->money($high)}.",
        ];
    }

    /** Thèmes reconnus dans les avis : [point fort, point faible, mots positifs, mots négatifs]. */
    private const REVIEW_THEMES = [
        'delay' => ['Livraison rapide', 'Retards de livraison', ['rapide', 'délai', 'temps', 'ponctuel'], ['retard', 'lent', 'lente', 'attente', 'tard']],
        'quality' => ['Qualité des produits', 'Problèmes de qualité', ['qualité', 'conforme', 'solide', 'parfait', 'impeccable'], ['défaut', 'abîmé', 'cassé', 'défectueux', 'conforme']],
        'price' => ['Bon rapport qualité-prix', 'Prix jugés élevés', ['prix', 'rapport'], ['cher', 'chère', 'coûteux', 'prix']],
        'service' => ['Équipe réactive', 'Communication difficile', ['réactif', 'réactive', 'équipe', 'accueil', 'disponible', 'réponse', 'professionnel'], ['injoignable', 'réponse', 'impoli', 'ignoré']],
        'packaging' => ['Emballage soigné', 'Emballage insuffisant', ['emballage', 'soigné', 'protégé'], ['emballage', 'mal']],
    ];

    private const POSITIVE_WORDS = ['bien', 'bon', 'bonne', 'excellent', 'excellente', 'parfait', 'parfaite', 'rapide', 'recommande', 'satisfait',
        'satisfaite', 'merci', 'impeccable', 'réactif', 'réactive', 'conforme', 'qualité', 'top', 'super', 'professionnel'];

    private const NEGATIVE_WORDS = ['mauvais', 'mauvaise', 'retard', 'déçu', 'déçue', 'cassé', 'abîmé', 'défaut', 'défectueux', 'lent', 'lente',
        'arnaque', 'jamais', 'injoignable', 'problème', 'cher', 'éviter', 'nul', 'nulle', 'pire'];

    /**
     * Sentiment et indice de suspicion d'un avis (SCRUM-83, SCRUM-84).
     *
     * @param  array{rating: int, comment: ?string, signals: array<string, int>}  $data
     * @return array{sentiment: string, suspicion_score: int, suspicion_reasons: list<string>}
     */
    private function reviewAnalysis(array $data): array
    {
        $comment = (string) ($data['comment'] ?? '');
        [$positive, $negative] = $this->polarity($comment);
        $tone = ($data['rating'] - 3) + $positive - $negative;
        $sentiment = $tone > 0 ? 'positif' : ($tone < 0 ? 'négatif' : 'neutre');

        $signals = $data['signals'];
        $score = 0;
        $reasons = [];
        $add = function (int $points, string $reason) use (&$score, &$reasons) {
            $score += $points;
            $reasons[] = $reason;
        };

        if ($signals['author_reviews_24h'] >= 3) {
            $add(35, "{$signals['author_reviews_24h']} avis du même auteur en 24 h");
        }
        if ($signals['duplicates'] > 0) {
            $add(40, 'Texte identique à un autre avis');
        }
        if ($signals['account_age_days'] < 2) {
            $add(15, 'Compte créé il y a moins de 2 jours');
        }
        if (in_array($data['rating'], [1, 5], true) && mb_strlen(trim($comment)) < 15) {
            $add(15, 'Note extrême sans commentaire détaillé');
        }
        if (($data['rating'] >= 4 && $negative > $positive + 1) || ($data['rating'] <= 2 && $positive > $negative + 1)) {
            $add(25, 'Note en contradiction avec le commentaire');
        }
        if (preg_match('/(https?:\/\/|www\.|@[a-z0-9-]+\.|\b\d{8}\b)/i', $comment)) {
            $add(20, 'Contient un lien ou des coordonnées');
        }

        return ['sentiment' => $sentiment, 'suspicion_score' => min(100, $score), 'suspicion_reasons' => $reasons];
    }

    /**
     * Points forts et points faibles d'un fournisseur à partir de ses avis (SCRUM-83).
     *
     * @param  array{reviews: list<array{rating: int, comment: ?string}>}  $data
     * @return array{summary: string, strengths: list<string>, weaknesses: list<string>}
     */
    private function supplierReviewSummary(array $data): array
    {
        $strengths = $weaknesses = [];
        $positive = $negative = 0;

        foreach ($data['reviews'] as $review) {
            $words = $this->stems((string) $review['comment'], false);
            $good = $review['rating'] >= 4;
            $bad = $review['rating'] <= 2;
            $positive += (int) $good;
            $negative += (int) $bad;

            foreach (self::REVIEW_THEMES as $key => [$strength, $weakness, $positiveWords, $negativeWords]) {
                if ($good && array_intersect($words, $this->stems(implode(' ', $positiveWords), false))) {
                    $strengths[$strength] = ($strengths[$strength] ?? 0) + 1;
                }
                if ($bad && array_intersect($words, $this->stems(implode(' ', $negativeWords), false))) {
                    $weaknesses[$weakness] = ($weaknesses[$weakness] ?? 0) + 1;
                }
            }
        }

        arsort($strengths);
        arsort($weaknesses);
        $count = count($data['reviews']);
        $neutral = $count - $positive - $negative;

        return [
            'summary' => "{$count} avis analysés : {$positive} positif".($positive > 1 ? 's' : '').", {$neutral} mitigé".($neutral > 1 ? 's' : '')
                .", {$negative} négatif".($negative > 1 ? 's' : '').'.',
            'strengths' => array_slice(array_keys($strengths), 0, 3),
            'weaknesses' => array_slice(array_keys($weaknesses), 0, 3),
        ];
    }

    /**
     * Annonce douteuse (SCRUM-84) : prix anormal pour la catégorie, coordonnées dans le texte, termes suspects.
     *
     * @param  array{title: string, description: ?string, price: float, category_median: ?float}  $data
     * @return array{suspicion_score: int, reasons: list<string>}
     */
    private function productModeration(array $data): array
    {
        $text = $data['title'].' '.$data['description'];
        $score = 0;
        $reasons = [];

        if ($data['category_median'] !== null && $data['category_median'] > 0) {
            $ratio = $data['price'] / $data['category_median'];
            if ($ratio < 0.2) {
                $score += 40;
                $reasons[] = 'Prix très inférieur aux produits de la catégorie';
            } elseif ($ratio > 10) {
                $score += 30;
                $reasons[] = 'Prix très supérieur aux produits de la catégorie';
            }
        }
        if (preg_match('/(https?:\/\/|www\.|[a-z0-9._-]+@[a-z0-9-]+\.[a-z]{2,}|(\+216\s?)?\b\d{2}\s?\d{3}\s?\d{3}\b)/i', $text)) {
            $score += 35;
            $reasons[] = 'Coordonnées ou lien dans l’annonce (contact hors plateforme)';
        }
        if (preg_match('/\b(contrefa[cç]on|r[ée]plique|copie conforme|imitation|sans facture|100\s?% garanti)\b/iu', $text)) {
            $score += 50;
            $reasons[] = 'Termes évoquant une contrefaçon ou une vente douteuse';
        }
        if (mb_strlen($data['title']) >= 10 && mb_strtoupper($data['title']) === $data['title'] && preg_match('/\p{L}/u', $data['title'])) {
            $score += 10;
            $reasons[] = 'Titre entièrement en majuscules';
        }

        return ['suspicion_score' => min(100, $score), 'reasons' => $reasons];
    }

    /**
     * Chatbot (SCRUM-85) : la fiche du guide qui partage le plus de mots avec la question.
     *
     * @param  array{message: string, guide: list<array{title: string, keywords: list<string>, answer: string, links: list<array{0: string, 1: string}>}>, fallback: string}  $data
     * @return array{answer: string, links: list<array{label: string, path: string}>}
     */
    private function chatbot(array $data): array
    {
        $message = $data['message'];

        // Données d'un autre utilisateur : le guide n'en contient pas, et l'assistant le dit clairement.
        if (preg_match('/\b(e-?mail|t[ée]l[ée]phone|num[ée]ro|adresse|coordonn[ée]es|commandes?|devis|chiffre)\s+(de|du|d’|d\')\s*(?!la plateforme|mon|ma|mes)/iu', $message)) {
            return [
                'answer' => 'Je n’ai accès à aucune information sur les autres utilisateurs et ne peux donc pas la communiquer. Pour échanger avec un fournisseur ou un porteur de projet, utilisez la messagerie de la plateforme.',
                'links' => [],
            ];
        }

        $stems = $this->stems($message, false);
        if ($stems === [] || preg_match('/^\s*(bonjour|bonsoir|salut|merci|hello|aide)\b[\s!.?]*$/iu', $message)) {
            return [
                'answer' => 'Bonjour ! Dites-moi ce que vous souhaitez faire : publier une demande, répondre à une demande, commander, payer, suivre une commande, laisser un avis…',
                'links' => [],
            ];
        }

        $best = null;
        foreach ($data['guide'] as $section) {
            $vocabulary = $this->stems(implode(' ', $section['keywords']).' '.$section['title'], false);
            $score = count(array_intersect($stems, $vocabulary));

            if ($score > 0 && ($best === null || $score > $best['score'])) {
                $best = ['score' => $score, 'section' => $section];
            }
        }

        if ($best === null) {
            return ['answer' => $data['fallback'], 'links' => []];
        }

        return [
            'answer' => $best['section']['answer'],
            'links' => array_map(
                fn (array $link) => ['label' => $link[0], 'path' => $link[1]],
                array_slice($best['section']['links'], 0, 3),
            ),
        ];
    }

    /**
     * @return array{0: int, 1: int} nombre de mots positifs et négatifs
     */
    private function polarity(string $text): array
    {
        $stems = $this->stems($text, false);
        $negated = (bool) preg_match('/\b(pas|jamais|aucun|aucune)\b/iu', $text);
        $positive = count(array_intersect($stems, $this->stems(implode(' ', self::POSITIVE_WORDS), false)));
        $negative = count(array_intersect($stems, $this->stems(implode(' ', self::NEGATIVE_WORDS), false)));

        // « pas conforme », « jamais livré » : la négation retourne une partie du positif.
        return $negated && $positive > 0 ? [$positive - 1, $negative + 1] : [$positive, $negative];
    }

    /**
     * @param  list<float>  $sorted
     */
    private function quantile(array $sorted, float $q): float
    {
        $position = (count($sorted) - 1) * $q;
        $lower = (int) floor($position);
        $upper = (int) ceil($position);

        return $sorted[$lower] + ($sorted[$upper] - $sorted[$lower]) * ($position - $lower);
    }

    /**
     * @return list<string>
     */
    private function words(string $text, bool $tenderWords = true): array
    {
        $text = (string) preg_replace('/[^\p{L}\p{N}\s]+/u', ' ', mb_strtolower($text));
        $stop = ['avec', 'pour', 'dans', 'nous', 'vous', 'sont', 'une', 'des', 'les', 'sur', 'par', 'plus', 'besoin',
            'recherchons', 'cherche', 'cherchons', 'demande', 'devis', 'fournisseur', 'fournisseurs', 'environ', 'merci',
            'livraison', 'quantité', 'qualité', 'unités', 'pièces', 'mois', 'jours', 'semaine', 'avant', 'après'];

        return array_values(array_filter(
            preg_split('/\s+/u', $text, -1, PREG_SPLIT_NO_EMPTY) ?: [],
            fn (string $word) => mb_strlen($word) >= 4 && ! ($tenderWords && in_array($word, $stop, true)) && ! is_numeric($word),
        ));
    }

    /**
     * @return list<string>
     */
    private function stems(string $text, bool $tenderWords = true): array
    {
        return array_values(array_unique(array_map(fn (string $word) => $this->stem($word), $this->words($text, $tenderWords))));
    }

    /** Racine grossière : sans accents ni marque du pluriel (« cartons » = « carton »). */
    private function stem(string $word): string
    {
        $word = Str::lower(Str::ascii($word));

        return mb_strlen($word) > 4 ? (string) preg_replace('/(s|x)$/', '', $word) : $word;
    }

    private function rephrase(string $text): string
    {
        $text = Str::ucfirst(trim((string) preg_replace('/\s+/u', ' ', $text)));

        return preg_match('/[.!?]$/u', $text) ? $text : $text.'.';
    }

    private function money(float $amount): string
    {
        return number_format($amount, 2, ',', ' ').' TND';
    }

    private function decimal(float $value): string
    {
        return number_format($value, 1, ',', '');
    }

    private function days(int $days): string
    {
        return $days.' jour'.($days > 1 ? 's' : '');
    }
}
