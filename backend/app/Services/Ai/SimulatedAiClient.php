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
            "Objet : consultation pour {$data['text']}",
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
