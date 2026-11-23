<?php

namespace App\Services\Ai;

use App\Exceptions\AiUnavailableException;
use App\Models\AiInteraction;
use App\Models\User;
use Closure;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Support\Facades\RateLimiter;
use Throwable;

/**
 * Point d'entrée commun des fonctionnalités IA (SCRUM-119 / F25) : limite par utilisateur, appel du fournisseur,
 * validation de la sortie, enregistrement dans ai_interactions.
 */
class AiService
{
    public function isEnabled(): bool
    {
        return array_key_exists((string) config('ai.provider'), (array) config('ai.drivers'));
    }

    /**
     * @param  string  $inputHash  empreinte des données qui rendent le résultat périmé quand elles changent
     * @param  Closure(array<string, mixed>): array<string, mixed>  $validate  renvoie la sortie nettoyée, ou lève une exception
     *
     * @throws AiUnavailableException
     * @throws ThrottleRequestsException
     */
    public function run(User $user, AiRequest $request, string $context, string $inputHash, Closure $validate): AiInteraction
    {
        if (! $this->isEnabled()) {
            throw new AiUnavailableException('IA désactivée.');
        }

        $key = "ai:{$user->id}";

        if (RateLimiter::tooManyAttempts($key, (int) config('ai.rate_limit'))) {
            $minutes = max(1, (int) ceil(RateLimiter::availableIn($key) / 60));
            throw new ThrottleRequestsException("Limite d'utilisation de l'IA atteinte. Réessayez dans {$minutes} min.");
        }

        RateLimiter::hit($key, 3600);

        try {
            $response = app(AiClient::class)->generate($request);
            $output = $validate($response->data);
        } catch (AiUnavailableException $e) {
            report($e);
            throw $e;
        } catch (Throwable $e) {
            // Panne du pilote ou sortie non conforme : jamais d'erreur 500 à cause de l'IA.
            report($e);
            throw new AiUnavailableException("Réponse de l'IA inutilisable.", previous: $e);
        }

        return AiInteraction::create([
            'user_id' => $user->id,
            'feature' => $request->feature,
            'context' => $context,
            'input' => $request->data,
            'output' => $output,
            'provider' => $response->provider,
            'model' => $response->model,
            'input_hash' => $inputHash,
        ]);
    }
}
