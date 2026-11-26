<?php

namespace App\Services\Ai;

use App\Exceptions\AiUnavailableException;

/**
 * Contrat d'un fournisseur d'IA. Un pilote réel doit :
 * - respecter config('ai.timeout') ;
 * - transmettre $request->data comme des données, séparées de la consigne ;
 * - demander une réponse conforme à $request->schema ;
 * - transformer toute erreur (réseau, délai, quota, refus, réponse tronquée) en AiUnavailableException.
 */
interface AiClient
{
    /**
     * @throws AiUnavailableException
     */
    public function generate(AiRequest $request): AiResponse;
}
