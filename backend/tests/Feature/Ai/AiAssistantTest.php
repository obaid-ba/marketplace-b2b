<?php

namespace Tests\Feature\Ai;

use App\Contracts\AiClient;
use App\Models\User;
use App\Services\Ai\AiAssistant;
use App\Services\Ai\AiUnavailableException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * SCRUM-80 — service d'IA partagé et journalisation des interactions.
 * Tous les tests tournent en mode `mock` (aucune clé, aucun appel réseau).
 */
class AiAssistantTest extends TestCase
{
    use RefreshDatabase;

    public function test_le_mode_simule_genere_un_brouillon_de_demande(): void
    {
        $user = User::factory()->buyer()->create();

        $interaction = app(AiAssistant::class)->run(
            $user,
            'tender_draft',
            'fourniture de cartons',
            ['category' => 'Emballage', 'region' => 'Sfax'],
        );

        $this->assertSame($user->id, $interaction->user_id);
        $this->assertSame('tender_draft', $interaction->feature);
        $this->assertStringContainsString('fourniture de cartons', $interaction->output);
        $this->assertStringContainsString('Emballage', $interaction->output);
        $this->assertFalse($interaction->accepted);
        $this->assertDatabaseCount('ai_interactions', 1);
    }

    public function test_le_resume_de_devis_est_une_aide_a_la_decision(): void
    {
        $user = User::factory()->buyer()->create();

        $interaction = app(AiAssistant::class)->run(
            $user,
            'quote_summary',
            'comparaison',
            [
                'quotes' => [
                    ['supplier' => 'Atlas', 'amount' => '2900.00', 'delivery_days' => 5, 'rating_avg' => 4.1],
                    ['supplier' => 'Médina', 'amount' => '3100.00', 'delivery_days' => 3, 'rating_avg' => 4.6],
                ],
            ],
        );

        $this->assertStringContainsString('Atlas', $interaction->output);
        $this->assertStringContainsString('Médina', $interaction->output);
        $this->assertStringContainsString('Aide à la décision générée par IA', $interaction->output);
    }

    public function test_une_panne_du_fournisseur_remonte_un_message_lisible_sans_trace(): void
    {
        $this->app->bind(AiClient::class, fn () => new class implements AiClient
        {
            public function generate(string $feature, string $input, array $context = []): string
            {
                throw new \RuntimeException('timeout');
            }
        });

        $user = User::factory()->supplier()->create();

        $this->expectException(AiUnavailableException::class);
        $this->expectExceptionMessage('indisponible');

        try {
            app(AiAssistant::class)->run($user, 'product_text', 'Perceuse');
        } finally {
            $this->assertDatabaseCount('ai_interactions', 0);
        }
    }

    public function test_le_texte_produit_est_propose_et_modifiable(): void
    {
        $user = User::factory()->supplier()->create();

        $interaction = app(AiAssistant::class)->run($user, 'product_text', 'Perceuse sans fil', [
            'category' => 'Outillage',
        ]);

        $this->assertStringContainsString('Perceuse sans fil', $interaction->output);
        $this->assertStringContainsString('Outillage', $interaction->output);
        $this->assertStringNotContainsString('<script', $interaction->output);
    }
}
