<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Photo d'un produit (entité 9). position 1 = image principale.
 */
class ProductImage extends Model
{
    /** Disque public : les photos sont affichées dans le catalogue sans authentification. */
    public const DISK = 'public';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'product_id',
        'path',
        'position',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'position' => 'integer',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    /**
     * Adresse publique de l'image (les données de démo peuvent contenir une URL complète).
     */
    public function url(): string
    {
        return Str::startsWith($this->path, ['http://', 'https://'])
            ? $this->path
            : Storage::disk(self::DISK)->url($this->path);
    }
}
