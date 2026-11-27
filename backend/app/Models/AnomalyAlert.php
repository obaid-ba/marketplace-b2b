<?php

namespace App\Models;

use App\Enums\AnomalyStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * Alerte d'anomalie (SCRUM-86, docs/ENTITIES.md entité 30) : cible (compte ou commande), type, score de 0 à 100,
 * statut nouvelle / traitée / ignorée. Créée par AnomalyDetector, traitée par l'administrateur.
 */
class AnomalyAlert extends Model
{
    public const TARGET_ACCOUNT = 'compte';

    public const TARGET_ORDER = 'commande';

    public const TYPE_ORDER_SPIKE = 'pic de commandes';

    public const TYPE_REVIEW_BURST = 'avis en rafale';

    public const TYPE_UNUSUAL_AMOUNT = 'montant inhabituel';

    public const TYPE_NEW_ACCOUNT_LARGE_ORDER = 'grosse commande d’un nouveau compte';

    public const TYPE_REPEATED_DISPUTES = 'litiges répétés';

    /**
     * @var list<string>
     */
    protected $fillable = ['target_type', 'target_id', 'anomaly_type', 'score', 'status'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'score' => 'decimal:2',
            'status' => AnomalyStatus::class,
        ];
    }

    /**
     * @param  Builder<AnomalyAlert>  $query
     */
    public function scopeOpen(Builder $query): void
    {
        $query->where('status', AnomalyStatus::NEW->value);
    }
}
