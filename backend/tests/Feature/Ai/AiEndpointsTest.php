<?php

namespace Tests\Feature\Ai;

use App\Contracts\AiClient;
use App\Enums\TenderStatus;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * SCRUM-124 / SCRUM-77 / SCRUM-78 / SCRUM-79 / F30 — assistants IA.
 * Tous les tests utilisent le fournisseur simulé (mode `mock`).
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

    private function category(): int
    {
        return DB::table('categories')->insertGetId([
            'name' => 'Emballage',
            'position' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
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
            ->assertJsonPath('label', 'Brouillon généré par IA — à relire et modifier avant publication.');

        $this->assertStringContainsString('cartons double cannelure', $response->json('output'));
        $this->assertStringContainsString('Emballage', $response->json('output'));

        $this->assertDatabaseHas('ai_interactions', [
            'id' => $response->json('interaction_id'),
            'user_id' => $buyer->id,
            'feature' => 'tender_draft',
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
            'feature' => 'product_text',
        ]);
    }

    public function test_le_resume_des_devis_est_une_aide_a_la_decision(): void
    {
        $buyer = $this->buyer();
        $supplierOne = User::factory()->supplier()->create()->supplierProfile()->create([
            'company_name' => 'Atlas',
            'rating_avg' => 4.10,
        ]);
        $supplierTwo = User::factory()->supplier()->create()->supplierProfile()->create([
            'company_name' => 'Médina',
            'rating_avg' => 4.60,
        ]);

        $category = $this->category();
        $buyerProfile = $buyer->buyerProfile;

        $tender = DB::table('tenders')->insertGetId([
            'buyer_id' => $buyerProfile->id,
            'title' => 'Achat de cartons',
            'description' => 'Description',
            'category_id' => $category,
            'status' => TenderStatus::OPEN->value,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        foreach ([[$supplierOne, 2900.00, 5], [$supplierTwo, 3100.00, 3]] as [$supplier, $amount, $days]) {
            DB::table('quotes')->insert([
                'tender_id' => $tender,
                'supplier_id' => $supplier->id,
                'amount' => $amount,
                'delivery_days' => $days,
                'status' => 'envoyé',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $response = $this->actingAs($buyer, 'sanctum')
            ->postJson('/api/ai/quote-summary', ['tender_id' => $tender])
            ->assertOk()
            ->assertJsonPath('feature', 'quote_summary')
            ->assertJsonPath('label', 'Aide à la décision générée par IA');

        $this->assertStringContainsString('Atlas', $response->json('output'));
        $this->assertStringContainsString('Médina', $response->json('output'));
        $this->assertStringContainsString('Aide à la décision générée par IA', $response->json('output'));
        $this->assertDatabaseHas('ai_interactions', [
            'user_id' => $buyer->id,
            'feature' => 'quote_summary',
        ]);
    }

    public function test_un_acheteur_ne_resume_pas_les_devis_d_une_autre_demande(): void
    {
        $buyer = $this->buyer();
        $other = $this->buyer();

        $tender = DB::table('tenders')->insertGetId([
            'buyer_id' => $other->buyerProfile->id,
            'title' => 'Demande tierce',
            'description' => 'Description',
            'category_id' => $this->category(),
            'status' => TenderStatus::OPEN->value,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->actingAs($buyer, 'sanctum')
            ->postJson('/api/ai/quote-summary', ['tender_id' => $tender])
            ->assertNotFound();
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

    public function test_une_panne_du_fournisseur_renvoie_une_erreur_lisible(): void
    {
        $this->app->bind(AiClient::class, fn () => new class implements AiClient
        {
            public function generate(string $feature, string $input, array $context = []): string
            {
                throw new \RuntimeException('timeout');
            }
        });

        $this->actingAs($this->buyer(), 'sanctum')
            ->postJson('/api/ai/tender-draft', ['prompt' => 'Achat de cartons'])
            ->assertStatus(503)
            ->assertJsonPath('message', "L'assistant IA est momentanément indisponible. Réessayez ou rédigez le texte vous-même.");

        $this->assertDatabaseCount('ai_interactions', 0);
    }
}
