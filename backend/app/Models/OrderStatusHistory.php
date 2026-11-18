<?php

namespace App\Models;

use App\Enums\OrderStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Historique des statuts d'une commande (SCRUM-51, SCRUM-58 / F16).
 * Table immuable sans colonne updated_at.
 */
class OrderStatusHistory extends Model
{
    use HasFactory;

    protected $table = 'order_status_history';

    public const CREATED_AT = 'changed_at';
    public const UPDATED_AT = null;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'order_id',
        'status',
        'changed_by',
        'changed_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => OrderStatus::class,
            'changed_at' => 'datetime',
        ];
    }

    /**
     * Commande associée.
     */
    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class, 'order_id');
    }

    /**
     * Utilisateur ayant effectué le changement de statut.
     */
    public function changer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
