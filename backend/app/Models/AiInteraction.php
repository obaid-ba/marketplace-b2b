<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Trace d'un appel à l'IA (SCRUM-80 / F25).
 *
 * Toute sortie générée est conservée avec son entrée et son contexte, afin de
 * pouvoir l'auditer. `accepted` passe à vrai quand l'utilisateur garde le texte
 * proposé (les fonctionnalités IA restent des aides à la décision).
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
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'accepted' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
