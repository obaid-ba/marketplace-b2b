<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use RuntimeException;

/**
 * L'IA ne peut pas répondre : désactivée, en panne, trop lente, refus ou sortie inutilisable.
 * L'IA étant une aide, l'application doit toujours continuer sans elle.
 */
class AiUnavailableException extends RuntimeException
{
    public function render(): JsonResponse
    {
        return response()->json([
            'message' => "L'aide de l'IA n'est pas disponible pour le moment. Vous pouvez continuer sans elle.",
            'reason' => 'ai_unavailable',
        ], 503);
    }
}
