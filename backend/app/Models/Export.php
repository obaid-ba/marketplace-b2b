<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Demande d'export des statistiques d'administration (SCRUM-75 / F28).
 *
 * Le fichier est produit par un job en file d'attente ; l'administrateur est
 * notifié dès qu'il est prêt. Seuls les formats sans dépendance externe sont
 * acceptés (CSV) tant que la question Q7 n'est pas tranchée pour XLSX.
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
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'format',
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
            'period_from' => 'date',
            'period_to' => 'date',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
