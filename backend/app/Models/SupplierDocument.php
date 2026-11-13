<?php

namespace App\Models;

use App\Enums\ValidationStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SupplierDocument extends Model
{
    public const TYPE_COMMERCIAL_REGISTER = 'registre de commerce';

    public const TYPE_CERTIFICATION = 'certification';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'supplier_id',
        'type',
        'file_path',
        'status',
        'submitted_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => ValidationStatus::class,
            'submitted_at' => 'datetime',
        ];
    }

    /**
     * Profil fournisseur propriétaire du document.
     */
    public function supplierProfile(): BelongsTo
    {
        return $this->belongsTo(SupplierProfile::class, 'supplier_id');
    }
}
