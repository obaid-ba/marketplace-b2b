<?php

namespace App\Services;

use App\Enums\AnomalyStatus;
use App\Models\AnomalyAlert;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Détection des comptes et commandes au comportement inhabituel (SCRUM-86) : règles explicables, chacune avec
 * un score de 0 à 100. Une alerte reste unique par cible et par type tant qu'elle est « nouvelle » (son score
 * est relevé si la situation s'aggrave) ; après une décision de l'admin, la même alerte n'est pas recréée
 * pendant COOLDOWN_DAYS. L'outil alerte, l'administrateur décide : aucun compte n'est bloqué automatiquement.
 *
 * Les échecs de paiement ne sont pas encore surveillés : la plateforme n'enregistre pas les paiements (pas de table).
 */
class AnomalyDetector
{
    public const ORDER_SPIKE_COUNT = 5;      // commandes passées par un même porteur en une heure

    public const REVIEW_BURST_COUNT = 3;     // avis déposés par un même porteur en 24 h

    public const AMOUNT_FACTOR = 5;          // montant ≥ 5 × la médiane des commandes de la plateforme

    public const AMOUNT_MIN_HISTORY = 10;    // commandes nécessaires pour calculer une médiane fiable

    public const NEW_ACCOUNT_HOURS = 48;

    public const NEW_ACCOUNT_AMOUNT = 5000;  // TND

    public const DISPUTES_COUNT = 3;         // litiges ouverts par un même compte en 30 jours

    public const COOLDOWN_DAYS = 7;

    /**
     * @return int nombre d'alertes créées ou relevées
     */
    public function run(): int
    {
        return collect([
            ...$this->orderSpikes(),
            ...$this->reviewBursts(),
            ...$this->unusualAmounts(),
            ...$this->newAccountLargeOrders(),
            ...$this->repeatedDisputes(),
        ])->filter(fn (array $alert) => $this->record(...$alert))->count();
    }

    /**
     * @return list<array{0: string, 1: int, 2: string, 3: float}>
     */
    private function orderSpikes(): array
    {
        return DB::table('orders')
            ->join('buyer_profiles', 'buyer_profiles.id', '=', 'orders.buyer_id')
            ->where('orders.created_at', '>=', now()->subHour())
            ->groupBy('buyer_profiles.user_id')
            ->havingRaw('COUNT(*) >= ?', [self::ORDER_SPIKE_COUNT])
            ->selectRaw('buyer_profiles.user_id as user_id, COUNT(*) as total')
            ->get()
            ->map(fn (object $row) => [AnomalyAlert::TARGET_ACCOUNT, (int) $row->user_id, AnomalyAlert::TYPE_ORDER_SPIKE, min(100, 15 * $row->total)])
            ->all();
    }

    /**
     * @return list<array{0: string, 1: int, 2: string, 3: float}>
     */
    private function reviewBursts(): array
    {
        return DB::table('reviews')
            ->join('buyer_profiles', 'buyer_profiles.id', '=', 'reviews.buyer_id')
            ->where('reviews.created_at', '>=', now()->subDay())
            ->groupBy('buyer_profiles.user_id')
            ->havingRaw('COUNT(*) >= ?', [self::REVIEW_BURST_COUNT])
            ->selectRaw('buyer_profiles.user_id as user_id, COUNT(*) as total')
            ->get()
            ->map(fn (object $row) => [AnomalyAlert::TARGET_ACCOUNT, (int) $row->user_id, AnomalyAlert::TYPE_REVIEW_BURST, min(100, 25 * $row->total)])
            ->all();
    }

    /**
     * @return list<array{0: string, 1: int, 2: string, 3: float}>
     */
    private function unusualAmounts(): array
    {
        $totals = DB::table('orders')->where('created_at', '>=', now()->subYear())->orderBy('total')->pluck('total')
            ->map(fn ($total) => (float) $total)->values();

        if ($totals->count() < self::AMOUNT_MIN_HISTORY) {
            return [];
        }

        $median = $this->median($totals);

        if ($median <= 0) {
            return [];
        }

        return DB::table('orders')
            ->where('created_at', '>=', now()->subDay())
            ->where('total', '>=', $median * self::AMOUNT_FACTOR)
            ->get(['id', 'total'])
            ->map(fn (object $order) => [
                AnomalyAlert::TARGET_ORDER,
                (int) $order->id,
                AnomalyAlert::TYPE_UNUSUAL_AMOUNT,
                min(100, round(10 * $order->total / $median, 2)),
            ])
            ->all();
    }

    /**
     * @return list<array{0: string, 1: int, 2: string, 3: float}>
     */
    private function newAccountLargeOrders(): array
    {
        return DB::table('orders')
            ->join('buyer_profiles', 'buyer_profiles.id', '=', 'orders.buyer_id')
            ->join('users', 'users.id', '=', 'buyer_profiles.user_id')
            ->where('orders.created_at', '>=', now()->subDay())
            ->where('orders.total', '>=', self::NEW_ACCOUNT_AMOUNT)
            ->where('users.created_at', '>=', now()->subHours(self::NEW_ACCOUNT_HOURS))
            ->get(['orders.id'])
            ->map(fn (object $order) => [AnomalyAlert::TARGET_ORDER, (int) $order->id, AnomalyAlert::TYPE_NEW_ACCOUNT_LARGE_ORDER, 70.0])
            ->all();
    }

    /**
     * @return list<array{0: string, 1: int, 2: string, 3: float}>
     */
    private function repeatedDisputes(): array
    {
        return DB::table('disputes')
            ->where('created_at', '>=', now()->subDays(30))
            ->groupBy('opened_by')
            ->havingRaw('COUNT(*) >= ?', [self::DISPUTES_COUNT])
            ->selectRaw('opened_by, COUNT(*) as total')
            ->get()
            ->map(fn (object $row) => [AnomalyAlert::TARGET_ACCOUNT, (int) $row->opened_by, AnomalyAlert::TYPE_REPEATED_DISPUTES, min(100, 20 * $row->total)])
            ->all();
    }

    /**
     * @return bool vrai si une alerte a été créée ou son score relevé
     */
    private function record(string $targetType, int $targetId, string $type, float $score): bool
    {
        $existing = AnomalyAlert::query()
            ->where(['target_type' => $targetType, 'target_id' => $targetId, 'anomaly_type' => $type])
            ->latest('id')
            ->first();

        if ($existing?->status === AnomalyStatus::NEW) {
            if ($score <= (float) $existing->score) {
                return false;
            }
            $existing->update(['score' => $score]);

            return true;
        }

        // Déjà traitée ou ignorée récemment par l'admin : pas de nouvelle alerte pour la même situation.
        if ($existing && $existing->updated_at->gt(now()->subDays(self::COOLDOWN_DAYS))) {
            return false;
        }

        AnomalyAlert::create([
            'target_type' => $targetType,
            'target_id' => $targetId,
            'anomaly_type' => $type,
            'score' => $score,
            'status' => AnomalyStatus::NEW,
        ]);

        return true;
    }

    /**
     * Description lisible de la cible pour le back-office.
     *
     * @param  Collection<int, AnomalyAlert>  $alerts
     * @return Collection<int, array<string, mixed>>
     */
    public function present(Collection $alerts): Collection
    {
        $users = User::withTrashed()
            ->whereIn('id', $alerts->where('target_type', AnomalyAlert::TARGET_ACCOUNT)->pluck('target_id'))
            ->get(['id', 'name', 'email', 'role'])
            ->keyBy('id');

        $orders = DB::table('orders')
            ->leftJoin('buyer_profiles', 'buyer_profiles.id', '=', 'orders.buyer_id')
            ->leftJoin('users', 'users.id', '=', 'buyer_profiles.user_id')
            ->whereIn('orders.id', $alerts->where('target_type', AnomalyAlert::TARGET_ORDER)->pluck('target_id'))
            ->get(['orders.id', 'orders.total', 'users.name as buyer_name'])
            ->keyBy('id');

        return $alerts->map(function (AnomalyAlert $alert) use ($users, $orders) {
            $account = $alert->target_type === AnomalyAlert::TARGET_ACCOUNT ? $users->get($alert->target_id) : null;
            $order = $alert->target_type === AnomalyAlert::TARGET_ORDER ? $orders->get($alert->target_id) : null;

            return [
                'id' => $alert->id,
                'target_type' => $alert->target_type,
                'target_id' => $alert->target_id,
                'target_label' => match (true) {
                    $account !== null => "{$account->name} ({$account->email})",
                    $order !== null => "Commande n° {$order->id} — ".number_format((float) $order->total, 2, ',', ' ')." TND ({$order->buyer_name})",
                    default => ucfirst($alert->target_type)." n° {$alert->target_id}",
                },
                'anomaly_type' => $alert->anomaly_type,
                'score' => (float) $alert->score,
                'status' => $alert->status->value,
                'created_at' => $alert->created_at?->toIso8601String(),
                'updated_at' => $alert->updated_at?->toIso8601String(),
            ];
        })->values();
    }

    /**
     * @param  Collection<int, float>  $sorted
     */
    private function median(Collection $sorted): float
    {
        $middle = intdiv($sorted->count(), 2);

        return $sorted->count() % 2 ? $sorted[$middle] : ($sorted[$middle - 1] + $sorted[$middle]) / 2;
    }
}
