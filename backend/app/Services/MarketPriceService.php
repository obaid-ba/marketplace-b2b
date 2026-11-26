<?php

namespace App\Services;

use App\Enums\AiFeature;
use App\Enums\QuoteStatus;
use App\Models\AiInteraction;
use App\Models\Category;
use App\Models\Tender;
use App\Models\User;
use App\Services\Ai\AiRequest;
use App\Services\Ai\AiService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

/**
 * Prix habituel du marché pour une demande (SCRUM-82 / F31), affiché sur « Comparer les devis ».
 *
 * Transactions comparables des 12 derniers mois dans la catégorie de la demande (et ses sous-catégories) :
 * devis acceptés sur d'autres demandes et commandes directes du catalogue. Sous MIN_TRANSACTIONS,
 * l'application répond « données insuffisantes » sans interroger l'IA. Une estimation n'est qu'un repère :
 * elle ne dit pas quel devis choisir.
 */
class MarketPriceService
{
    public const MIN_TRANSACTIONS = 3;

    public const MONTHS = 12;

    private const INSTRUCTIONS = <<<'TXT'
        Tu aides un acheteur à juger si un devis est raisonnable. À partir des montants de transactions comparables
        (en TND), donne une fourchette habituelle (bas et haut), la valeur médiane et une phrase d'explication factuelle.
        N'invente aucune donnée et ne recommande aucun devis ni fournisseur.
        TXT;

    public function __construct(private readonly AiService $ai) {}

    /**
     * @return array<string, mixed>
     */
    public function estimate(User $user, Tender $tender): array
    {
        $amounts = $this->amounts($tender);
        $count = count($amounts);
        $base = [
            'transactions' => $count,
            'min_transactions' => self::MIN_TRANSACTIONS,
            'category' => $tender->category?->name,
            'months' => self::MONTHS,
        ];

        if ($count < self::MIN_TRANSACTIONS) {
            return ['status' => 'insufficient', ...$base];
        }

        $data = ['category' => $tender->category?->name, 'currency' => 'TND', 'amounts' => $amounts];
        $hash = hash('sha256', json_encode($data, JSON_THROW_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION));
        $context = "tender:{$tender->id}";

        // Mêmes transactions qu'à la dernière visite : l'estimation enregistrée est réutilisée.
        $interaction = AiInteraction::query()
            ->where('feature', AiFeature::PRICE_ESTIMATE)
            ->where('context', $context)
            ->where('input_hash', $hash)
            ->latest('id')
            ->first()
            ?? $this->ai->run(
                $user,
                new AiRequest(AiFeature::PRICE_ESTIMATE, self::INSTRUCTIONS, $data, $this->schema()),
                $context,
                $hash,
                fn (array $output) => $this->validate($output, min($amounts), max($amounts)),
            );

        return [
            'status' => 'ok',
            ...$base,
            'interaction_id' => $interaction->id,
            'low' => (float) $interaction->output['low'],
            'median' => (float) $interaction->output['median'],
            'high' => (float) $interaction->output['high'],
            'comment' => $interaction->output['comment'],
            'simulated' => $interaction->provider === Ai\SimulatedAiClient::NAME,
        ];
    }

    /**
     * Montants comparables, du plus ancien au plus récent.
     *
     * @return list<float>
     */
    private function amounts(Tender $tender): array
    {
        $categoryIds = Category::query()
            ->whereKey($tender->category_id)
            ->orWhere('parent_id', $tender->category_id)
            ->pluck('id');

        $since = now()->subMonths(self::MONTHS);

        $quotes = DB::table('quotes')
            ->join('tenders', 'tenders.id', '=', 'quotes.tender_id')
            ->whereIn('tenders.category_id', $categoryIds)
            ->where('tenders.id', '!=', $tender->id)
            ->where('quotes.status', QuoteStatus::ACCEPTED->value)
            ->where('quotes.updated_at', '>=', $since)
            ->pluck('quotes.amount');

        // Commandes directes (catalogue) : total des lignes de la catégorie, par commande.
        $orders = DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->join('products', 'products.id', '=', 'order_items.product_id')
            ->where('orders.origin', 'catalogue')
            ->whereIn('products.category_id', $categoryIds)
            ->where('orders.created_at', '>=', $since)
            ->groupBy('orders.id')
            ->selectRaw('SUM(order_items.quantity * order_items.unit_price) as amount')
            ->pluck('amount');

        return $quotes->concat($orders)
            ->map(fn ($amount) => round((float) $amount, 2))
            ->filter(fn (float $amount) => $amount > 0)
            ->values()
            ->all();
    }

    /**
     * La fourchette doit rester dans les montants observés et être ordonnée.
     *
     * @param  array<string, mixed>  $output
     * @return array{low: float, median: float, high: float, comment: string}
     */
    private function validate(array $output, float $min, float $max): array
    {
        $validated = Validator::make($output, [
            'low' => ['required', 'numeric', "between:{$min},{$max}"],
            'median' => ['required', 'numeric', 'gte:low'],
            'high' => ['required', 'numeric', 'gte:median', "max:{$max}"],
            'comment' => ['required', 'string', 'max:500'],
        ])->validate();

        return [
            'low' => round((float) $validated['low'], 2),
            'median' => round((float) $validated['median'], 2),
            'high' => round((float) $validated['high'], 2),
            'comment' => $validated['comment'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function schema(): array
    {
        return [
            'type' => 'object',
            'properties' => [
                'low' => ['type' => 'number'],
                'median' => ['type' => 'number'],
                'high' => ['type' => 'number'],
                'comment' => ['type' => 'string'],
            ],
            'required' => ['low', 'median', 'high', 'comment'],
            'additionalProperties' => false,
        ];
    }
}
