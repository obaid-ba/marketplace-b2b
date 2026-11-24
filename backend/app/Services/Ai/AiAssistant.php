<?php

namespace App\Services\Ai;

use App\Contracts\AiClient;
use App\Models\AiInteraction;
use App\Models\User;

/**
 * Point d'entrée unique des fonctionnalités IA (SCRUM-80 / F25).
 *
 * Appelle le fournisseur configuré puis journalise systématiquement l'entrée,
 * la sortie et le contexte dans `ai_interactions`. Une panne du fournisseur
 * remonte une erreur métier lisible, sans jamais bloquer l'utilisateur : le
 * texte reste modifiable à la main.
 */
class AiAssistant
{
    public function __construct(private readonly AiClient $client) {}

    /**
     * @param  array<string, mixed>  $context
     *
     * @throws AiUnavailableException
     */
    public function run(User $user, string $feature, string $input, array $context = []): AiInteraction
    {
        try {
            $output = $this->client->generate($feature, $input, $context);
        } catch (\Throwable $exception) {
            report($exception);

            throw new AiUnavailableException(
                "L'assistant IA est momentanément indisponible. Réessayez ou rédigez le texte vous-même.",
            );
        }

        return AiInteraction::create([
            'user_id' => $user->id,
            'feature' => $feature,
            'context' => $context['label'] ?? null,
            'input' => mb_substr($input, 0, 20000),
            'output' => $output,
            'accepted' => false,
        ]);
    }
}
