<?php

namespace App\Services\Ai;

/**
 * Réponse structurée. Elle reste à valider par la fonctionnalité qui l'a demandée.
 */
final readonly class AiResponse
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function __construct(
        public array $data,
        public string $provider,
        public ?string $model = null,
    ) {}
}
