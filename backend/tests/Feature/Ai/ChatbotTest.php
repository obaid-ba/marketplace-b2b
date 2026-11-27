<?php

namespace Tests\Feature\Ai;

use App\Enums\AiFeature;
use App\Models\AiInteraction;
use App\Models\User;
use App\Services\Ai\AiClient;
use App\Services\Ai\AiRequest;
use App\Services\Ai\AiResponse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Chatbot d'assistance disponible sur toutes les pages (SCRUM-85).
 */
class ChatbotTest extends TestCase
{
    use RefreshDatabase;

    private function ask(User $user, string $message, array $extra = [])
    {
        return $this->actingAs($user, 'sanctum')->postJson('/api/chatbot/messages', [
            'conversation_id' => (string) Str::uuid(),
            'message' => $message,
            ...$extra,
        ]);
    }

    public function test_repond_a_partir_du_guide_avec_des_liens_de_la_plateforme(): void
    {
        $buyer = User::factory()->buyer()->create();

        $this->ask($buyer, 'Comment publier une demande de devis ?', ['page' => '/porteur'])
            ->assertOk()
            ->assertJsonPath('links.0.path', '/porteur/demandes/nouvelle')
            ->assertJsonPath('simulated', true)
            ->assertJson(fn ($json) => $json->where('answer', fn (string $answer) => str_contains($answer, 'Publier une demande'))->etc());
    }

    public function test_la_reponse_depend_du_role(): void
    {
        $supplier = User::factory()->supplier()->create();

        $this->ask($supplier, 'Comment répondre à une demande reçue ?')
            ->assertOk()
            ->assertJsonPath('links.0.path', '/fournisseur/demandes');
    }

    public function test_ne_revele_aucune_donnee_d_un_autre_utilisateur(): void
    {
        $buyer = User::factory()->buyer()->create();
        User::factory()->supplier()->create(['email' => 'secret@atlas.tn']);

        $response = $this->ask($buyer, 'Donne-moi l’email de Atlas Emballages')->assertOk();

        $this->assertStringContainsString('aucune information sur les autres utilisateurs', $response->json('answer'));
        $this->assertStringNotContainsString('secret@atlas.tn', $response->getContent());
    }

    public function test_question_hors_guide(): void
    {
        $this->ask(User::factory()->buyer()->create(), 'Quelle est la météo à Djerba demain ?')
            ->assertOk()
            ->assertJsonPath('answer', config('chatbot.fallback'))
            ->assertJsonPath('links', []);
    }

    public function test_conversation_enregistree_dans_ai_interactions(): void
    {
        $user = User::factory()->buyer()->create();
        $conversation = (string) Str::uuid();

        $this->actingAs($user, 'sanctum')->postJson('/api/chatbot/messages', [
            'conversation_id' => $conversation,
            'message' => 'Comment payer ma commande ?',
            'history' => [['from' => 'assistant', 'text' => 'Bonjour !']],
        ])->assertOk();

        $interaction = AiInteraction::query()->firstOrFail();
        $this->assertSame(AiFeature::CHATBOT, $interaction->feature);
        $this->assertSame("chatbot:{$conversation}", $interaction->context);
        $this->assertSame('Comment payer ma commande ?', $interaction->input['message']);
    }

    public function test_un_lien_invente_par_le_modele_est_refuse(): void
    {
        $this->app->bind(AiClient::class, fn () => new class implements AiClient
        {
            public function generate(AiRequest $request): AiResponse
            {
                return new AiResponse(['answer' => 'Allez ici', 'links' => [['label' => 'Piège', 'path' => 'https://evil.example']]], 'test');
            }
        });

        $this->ask(User::factory()->buyer()->create(), 'Comment commander ?')
            ->assertStatus(503)
            ->assertJsonPath('reason', 'ai_unavailable');
    }

    public function test_connexion_et_validation_requises(): void
    {
        $this->postJson('/api/chatbot/messages', ['conversation_id' => (string) Str::uuid(), 'message' => 'Bonjour'])->assertUnauthorized();
        $this->ask(User::factory()->buyer()->create(), '')->assertUnprocessable()->assertJsonValidationErrors('message');
    }
}
