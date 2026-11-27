<?php

namespace App\Models;

use App\Contracts\MediaStorage;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Photo d'un produit (entité 9). position 1 = image principale.
 */
class ProductImage extends Model
{
    /**
     * Disque Laravel utilisé par le pilote « local » (voir App\Services\Media\LocalMediaStorage).
     * Conservé pour les tests qui bouchonnent ce disque.
     */
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
     * Adresse publique de l'image (disque local en développement, CDN Cloudinary en production).
     */
    public function url(): string
    {
        return (string) app(MediaStorage::class)->url($this->path);
    }
}
