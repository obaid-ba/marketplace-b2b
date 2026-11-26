<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Demande d'export des statistiques d'administration (SCRUM-75 / F28).
 *
 * Le fichier est produit par un job en file d'attente ; l'administrateur est
 * notifié dès qu'il est prêt. Formats : CSV et XLSX (D23).
 */
class Export extends Model
{
    public const STATUS_QUEUED = 'en attente';

    public const STATUS_PROCESSING = 'en cours';

    public const STATUS_READY = 'prêt';

    public const STATUS_FAILED = 'échec';

    public const FORMAT_CSV = 'csv';

    public const FORMAT_XLSX = 'xlsx';

    /**
     * Indicateurs proposés (SCRUM-75).
     *
     * @var array<string, string>
     */
    public const INDICATORS = [
        'signups' => 'Inscriptions',
        'orders' => 'Commandes',
        'revenue' => "Chiffre d'affaires (TND)",
        'tenders' => 'Demandes',
        'categories' => 'Catégories',
    ];

    /**
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'format',
        'indicators',
        'period_from',
        'period_to',
        'status',
        'file_path',
        'error',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'indicators' => 'array',
            // Format explicite : sans lui, minuit à Tunis est renvoyé en UTC, donc la veille.
            'period_from' => 'date:Y-m-d',
            'period_to' => 'date:Y-m-d',
        ];
    }

    /**
     * @return list<string>
     */
    public function selectedIndicators(): array
    {
        return $this->indicators ?: array_keys(self::INDICATORS);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
