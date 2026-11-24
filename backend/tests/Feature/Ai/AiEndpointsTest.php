<?php

namespace Tests\Feature\Ai;

use App\Models\AiInteraction;
use App\Models\User;
use App\Services\Ai\AiClient;
use App\Services\Ai\AiRequest;
use App\Services\Ai\AiResponse;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * SCRUM-124 / SCRUM-77 / SCRUM-78 / F30 — assistants IA.
 * Le fournisseur est simulé ; le résumé des devis est testé dans QuoteSummaryTest.
 */
class AiEndpointsTest extends TestCase
{
    use RefreshDatabase;

    private function buyer(): User
    {
        $user = User::factory()->buyer()->create();
        $user->buyerProfile()->create(['organization' => 'Porteur']);

        return $user;
    }

    private function supplier(): User
    {
        $user = User::factory()->supplier()->create();
        $user->supplierProfile()->create(['company_name' => 'Atlas']);

        return $user;
    }

    public function test_les_assistants_ia_exigent_une_authentification_et_le_bon_role(): void
    {
        $this->postJson('/api/ai/tender-draft', ['prompt' => 'Achat de cartons'])->assertUnauthorized();

        $this->actingAs($this->supplier(), 'sanctum')
            ->postJson('/api/ai/tender-draft', ['prompt' => 'Achat de cartons'])
            ->assertForbidden();

        $this->actingAs($this->buyer(), 'sanctum')
            ->postJson('/api/ai/product-text', ['text' => 'Perceuse'])
            ->assertForbidden();
    }

    public function test_le_brouillon_de_demande_est_modifiable_et_journalise(): void
    {
        $buyer = $this->buyer();

        $response = $this->actingAs($buyer, 'sanctum')
            ->postJson('/api/ai/tender-draft', [
                'prompt' => 'fourniture de cartons double cannelure',
                'category' => 'Emballage',
                'region' => 'Sfax',
            ])
            ->assertOk()
            ->assertJsonPath('feature', 'tender_draft')
            ->assertJsonPath('editable', true)
            ->assertJsonPath('simulated', true)
            ->assertJsonPath('label', 'Mode simulé, sans IA — à relire et modifier avant publication.');

        $this->assertStringContainsString('cartons double cannelure', $response->json('output'));
        $this->assertStringContainsString('Emballage', $response->json('output'));

        $this->assertDatabaseHas('ai_interactions', [
            'id' => $response->json('interaction_id'),
            'user_id' => $buyer->id,
            'feature' => 'rédaction',
            'context' => 'tender_draft',
            'accepted' => false,
        ]);
    }

    public function test_le_texte_produit_compare_avant_et_apres(): void
    {
        $supplier = $this->supplier();

        $response = $this->actingAs($supplier, 'sanctum')
            ->postJson('/api/ai/product-text', [
                'text' => 'Perceuse sans fil 18V',
                'action' => 'rephrase',
                'category' => 'Outillage',
            ])
            ->assertOk()
            ->assertJsonPath('feature', 'product_text')
            ->assertJsonPath('editable', true)
            ->assertJsonPath('before', 'Perceuse sans fil 18V');

        $this->assertNotEmpty($response->json('after'));
        $this->assertDatabaseHas('ai_interactions', [
            'user_id' => $supplier->id,
            'feature' => 'reformulation',
            'context' => 'product_text',
        ]);
    }

    public function test_une_suggestion_peut_etre_marquee_comme_acceptee_par_son_auteur(): void
    {
        $buyer = $this->buyer();

        $response = $this->actingAs($buyer, 'sanctum')
            ->postJson('/api/ai/tender-draft', ['prompt' => 'Achat de cartons'])
            ->assertOk();

        $this->actingAs($buyer, 'sanctum')
            ->postJson("/api/ai/interactions/{$response->json('interaction_id')}/accept")
            ->assertOk()
            ->assertJsonPath('interaction.accepted', true);

        $this->actingAs($this->buyer(), 'sanctum')
            ->postJson("/api/ai/interactions/{$response->json('interaction_id')}/accept")
            ->assertNotFound();
    }

    public function test_le_mode_simule_n_invente_aucune_qualite(): void
    {
        $this->actingAs($this->supplier(), 'sanctum')
            ->postJson('/api/ai/product-text', ['text' => 'perceuse  sans fil 18V', 'category' => 'Outillage'])
            ->assertOk()
            ->assertJsonPath('output', "Perceuse sans fil 18V.\n\nCatégorie : Outillage.");
    }

    public function test_une_panne_ou_une_sortie_invalide_renvoie_une_erreur_lisible_sans_trace(): void
    {
        foreach ([fn () => throw new \RuntimeException('timeout'), fn () => ['autre' => 'x'], fn () => ['text' => '']] as $reply) {
            $this->app->bind(AiClient::class, fn () => new class($reply) implements AiClient
            {
                public function __construct(private $reply) {}

                public function generate(AiRequest $request): AiResponse
                {
                    return new AiResponse(($this->reply)(), 'test');
                }
            });

            $this->actingAs($this->buyer(), 'sanctum')
                ->postJson('/api/ai/tender-draft', ['prompt' => 'Achat de cartons'])
                ->assertStatus(503)
                ->assertJsonPath('reason', 'ai_unavailable');
        }

        $this->assertDatabaseCount('ai_interactions', 0);
    }

    public function test_les_redactions_comptent_dans_la_limite_par_utilisateur(): void
    {
        config(['ai.rate_limit' => 1]);
        $buyer = $this->buyer();

        $this->actingAs($buyer, 'sanctum')->postJson('/api/ai/tender-draft', ['prompt' => 'Achat de cartons'])->assertOk();
        $this->actingAs($buyer, 'sanctum')->postJson('/api/ai/tender-draft', ['prompt' => 'Achat de palettes'])->assertTooManyRequests();
        $this->assertSame(1, AiInteraction::count());
    }

    public function test_l_ancien_nom_mock_reste_accepte(): void
    {
        config(['ai.provider' => 'mock']);

        $this->actingAs($this->buyer(), 'sanctum')
            ->postJson('/api/ai/tender-draft', ['prompt' => 'Achat de cartons'])
            ->assertOk()
            ->assertJsonPath('simulated', true);
    }
}
