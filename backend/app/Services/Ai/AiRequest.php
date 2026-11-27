<?php

namespace App\Services\Ai;

use App\Enums\AiFeature;

/**
 * Demande faite à l'IA, indépendante du fournisseur.
 */
final readonly class AiRequest
{
    /**
     * @param  string  $instructions  consigne écrite par l'application : la seule à suivre
     * @param  array<string, mixed>  $data  données à analyser ; peut contenir du texte saisi par des utilisateurs,
     *                                      à ne JAMAIS traiter comme une consigne
     * @param  array<string, mixed>  $schema  schéma JSON de la réponse attendue
     */
    public function __construct(
        public AiFeature $feature,
        public string $instructions,
        public array $data,
        public array $schema,
    ) {}
}
