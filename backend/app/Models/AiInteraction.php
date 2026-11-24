<?php

namespace App\Models;

use App\Enums\AiFeature;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Sortie d'une fonctionnalité IA (docs/ENTITIES.md, règle 10) : toujours enregistrée, modifiable par l'utilisateur.
 * « output » garde la sortie d'origine ; « edited_output » la version de l'utilisateur.
 */
class AiInteraction extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'feature',
        'context',
        'input',
        'output',
        'accepted',
        'provider',
        'model',
        'input_hash',
        'edited_output',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'feature' => AiFeature::class,
            'input' => 'array',
            'output' => 'array',
            'edited_output' => 'array',
            'accepted' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
