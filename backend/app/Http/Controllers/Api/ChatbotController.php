<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Ai\SimulatedAiClient;
use App\Services\ChatbotService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Chatbot d'assistance (SCRUM-85) : un message de l'utilisateur, une réponse fondée sur le guide de la plateforme.
 */
class ChatbotController extends Controller
{
    public function send(Request $request, ChatbotService $chatbot): JsonResponse
    {
        $validated = $request->validate([
            'conversation_id' => ['required', 'uuid'],
            'message' => ['required', 'string', 'min:2', 'max:1000'],
            'page' => ['nullable', 'string', 'max:200'],
            'history' => ['nullable', 'array', 'max:20'],
            'history.*.from' => ['required', 'string', 'in:user,assistant'],
            'history.*.text' => ['required', 'string', 'max:2000'],
        ], [
            'message.required' => 'Écrivez votre question.',
            'message.max' => 'Votre question ne doit pas dépasser 1000 caractères.',
        ]);

        $interaction = $chatbot->reply(
            $request->user(),
            $validated['conversation_id'],
            $validated['message'],
            $validated['history'] ?? [],
            $validated['page'] ?? null,
        );

        return response()->json([
            'interaction_id' => $interaction->id,
            'answer' => $interaction->output['answer'],
            'links' => $interaction->output['links'],
            'simulated' => $interaction->provider === SimulatedAiClient::NAME,
        ]);
    }
}
