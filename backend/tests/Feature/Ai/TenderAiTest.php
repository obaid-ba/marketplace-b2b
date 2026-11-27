<?php

namespace Tests\Feature\Ai;

use App\Enums\AiFeature;
use App\Enums\QuoteStatus;
use App\Enums\TenderStatus;
use App\Enums\ValidationStatus;
use App\Models\AiInteraction;
use App\Models\Category;
use App\Models\Product;
use App\Models\Quote;
use App\Models\Region;
use App\Models\SupplierProfile;
use App\Models\Tender;
use App\Models\TenderRecipient;
use App\Models\User;
use App\Notifications\TenderReceivedNotification;
use App\Services\RelevanceScorer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * IA sur les demandes (SCRUM-125 / F31) : catégorie et fournisseurs suggérés (SCRUM-81), prix du marché (SCRUM-82).
 */
class TenderAiTest extends TestCase
{
    use RefreshDatabase;

    private User $buyer;

    private Category $emballage;

    private Category $cartons;

    private Category $informatique;

    private Region $sfax;

    private SupplierProfile $atlas;

    private SupplierProfile $djerbaPack;

    private const TEXT = [
        'title' => 'Cartons ondulés pour expédition',
        'description' => 'Nous cherchons 5000 cartons ondulés double cannelure, impression une couleur, pour expédier nos huiles.',
    ];

    protected function setUp(): void
    {
        parent::setUp();

        $this->sfax = Region::create(['name' => 'Sfax']);
        $this->emballage = Category::create(['name' => 'Emballage et conditionnement', 'position' => 1]);
        $this->cartons = Category::create(['name' => 'Cartonnage', 'parent_id' => $this->emballage->id, 'position' => 1]);
        $this->informatique = Category::create(['name' => 'Informatique', 'position' => 2]);

        $this->atlas = $this->supplier('Atlas Emballages', [$this->cartons], ['region_id' => $this->sfax->id, 'rating_avg' => 4.6, 'reviews_count' => 12]);
        $this->djerbaPack = $this->supplier('Djerba Pack', [$this->emballage]);
        Product::factory()->published()->for($this->atlas, 'supplier')->create(['category_id' => $this->cartons->id, 'title' => 'Cartons ondulés sur mesure']);

        $this->buyer = User::factory()->buyer()->create();
        $this->buyer->buyerProfile()->create(['organization' => 'Huilerie du Sahel']);
    }

    /**
     * @param  list<Category>  $categories
     */
    private function supplier(string $company, array $categories, array $attributes = []): SupplierProfile
    {
        $supplier = SupplierProfile::factory()->visible()->create(['company_name' => $company, ...$attributes]);
        $supplier->categories()->attach(collect($categories)->pluck('id'));

        return $supplier;
    }

    private function analyze(array $payload = [])
    {
        return $this->actingAs($this->buyer, 'sanctum')->postJson('/api/buyer/tenders/analyze', [...self::TEXT, ...$payload]);
    }

    public function test_detecte_la_categorie_les_mots_cles_et_suggere_des_fournisseurs(): void
    {
        // Fournisseur de la catégorie mais pas encore validé : jamais suggéré.
        $this->supplier('Cartons non validés', [$this->cartons], ['validation_status' => ValidationStatus::PENDING]);

        $response = $this->analyze(['region_id' => $this->sfax->id])
            ->assertOk()
            ->assertJsonPath('category.id', $this->cartons->id)
            ->assertJsonPath('category.name', 'Cartonnage')
            ->assertJsonPath('simulated', true)
            ->assertJsonPath('suggested_suppliers.0.id', $this->atlas->id)
            ->assertJsonPath('suggested_suppliers.0.reasons', ['Propose « Cartonnage »', 'Situé dans votre région', 'Note 4,6 / 5'])
            ->assertJsonCount(1, 'suggested_suppliers');

        $this->assertContains('cartons', $response->json('keywords'));
        $this->assertDatabaseHas('ai_interactions', [
            'user_id' => $this->buyer->id,
            'feature' => AiFeature::MATCHING->value,
            'context' => 'tender:draft',
        ]);
    }

    public function test_la_categorie_choisie_par_le_porteur_prime_pour_les_suggestions(): void
    {
        $this->analyze(['category_id' => $this->emballage->id])
            ->assertOk()
            ->assertJsonPath('category.id', $this->cartons->id) // proposition inchangée
            ->assertJsonCount(2, 'suggested_suppliers'); // catégorie principale et ses sous-catégories
    }

    public function test_un_texte_inchange_reutilise_l_analyse(): void
    {
        $this->analyze()->assertOk();
        $this->analyze()->assertOk();

        $this->assertSame(1, AiInteraction::query()->where('feature', AiFeature::MATCHING)->count());
    }

    public function test_texte_sans_categorie_reconnue(): void
    {
        $this->analyze(['title' => 'Besoin particulier', 'description' => 'Quelque chose de tout à fait unique, introuvable ailleurs.'])
            ->assertOk()
            ->assertJsonPath('category', null)
            ->assertJsonPath('suggested_suppliers', []);
    }

    public function test_reserve_au_porteur_et_valide(): void
    {
        $this->actingAs($this->atlas->user, 'sanctum')->postJson('/api/buyer/tenders/analyze', self::TEXT)->assertForbidden();
        $this->analyze(['description' => 'trop court'])->assertUnprocessable()->assertJsonValidationErrors('description');
    }

    public function test_ia_desactivee_la_publication_reste_possible(): void
    {
        config(['ai.provider' => 'disabled']);

        $this->analyze()->assertStatus(503)->assertJsonPath('reason', 'ai_unavailable');
        $this->actingAs($this->buyer, 'sanctum')
            ->postJson('/api/buyer/tenders', [...self::TEXT, 'category_id' => $this->cartons->id])
            ->assertCreated();
    }

    public function test_publication_avec_analyse_et_fournisseurs_retenus(): void
    {
        Notification::fake();
        $interactionId = $this->analyze()->json('interaction_id');

        $tenderId = $this->actingAs($this->buyer, 'sanctum')->postJson('/api/buyer/tenders', [
            ...self::TEXT,
            'category_id' => $this->cartons->id,
            'ai_interaction_id' => $interactionId,
            'suggested_supplier_ids' => [$this->djerbaPack->id],
        ])->assertCreated()->json('id');

        $tender = Tender::findOrFail($tenderId);
        $this->assertSame($this->cartons->id, $tender->ai_category_id);
        $this->assertContains('cartons', $tender->ai_keywords);

        // Retenu par le porteur alors qu'il ne couvre que la catégorie parente : source « suggéré IA ».
        $recipient = TenderRecipient::query()->where('tender_id', $tenderId)->where('supplier_id', $this->djerbaPack->id)->firstOrFail();
        $this->assertSame(TenderRecipient::SOURCE_AI, $recipient->source);
        $this->assertNotNull($recipient->notified_at);
        Notification::assertSentTo($this->djerbaPack->user, TenderReceivedNotification::class);

        // Atlas reste diffusé automatiquement ; une seule notification par fournisseur.
        $this->assertSame(TenderRecipient::SOURCE_AUTOMATIC, TenderRecipient::query()->where('supplier_id', $this->atlas->id)->value('source'));
        Notification::assertSentToTimes($this->atlas->user, TenderReceivedNotification::class, 1);

        $interaction = AiInteraction::findOrFail($interactionId);
        $this->assertSame("tender:{$tenderId}", $interaction->context);
        $this->assertTrue($interaction->accepted);
        $this->assertNull($interaction->edited_output);
    }

    public function test_categorie_modifiee_par_le_porteur_est_gardee_a_part(): void
    {
        $interactionId = $this->analyze()->json('interaction_id');

        $this->actingAs($this->buyer, 'sanctum')->postJson('/api/buyer/tenders', [
            ...self::TEXT,
            'category_id' => $this->emballage->id,
            'ai_interaction_id' => $interactionId,
        ])->assertCreated();

        $interaction = AiInteraction::findOrFail($interactionId);
        $this->assertFalse($interaction->accepted);
        $this->assertSame(['category_id' => $this->emballage->id], $interaction->edited_output);
        $this->assertSame($this->cartons->id, $interaction->output['category_id']); // sortie d'origine conservée
    }

    public function test_analyse_d_un_autre_et_fournisseur_non_visible_ignores(): void
    {
        $other = User::factory()->buyer()->create();
        $other->buyerProfile()->create(['organization' => 'Autre']);
        $foreign = $this->actingAs($other, 'sanctum')->postJson('/api/buyer/tenders/analyze', self::TEXT)->json('interaction_id');
        $hidden = $this->supplier('Caché', [$this->cartons], ['is_published' => false]);

        $tenderId = $this->actingAs($this->buyer, 'sanctum')->postJson('/api/buyer/tenders', [
            ...self::TEXT,
            'category_id' => $this->informatique->id,
            'ai_interaction_id' => $foreign,
            'suggested_supplier_ids' => [$hidden->id],
        ])->assertCreated()->json('id');

        $this->assertNull(Tender::findOrFail($tenderId)->ai_category_id);
        $this->assertDatabaseMissing('tender_recipients', ['tender_id' => $tenderId, 'supplier_id' => $hidden->id]);
        $this->assertSame('tender:draft', AiInteraction::findOrFail($foreign)->context);
    }

    public function test_le_score_tient_compte_de_la_categorie_detectee(): void
    {
        $tender = new Tender(['title' => 'x', 'description' => 'y', 'category_id' => $this->informatique->id, 'ai_category_id' => $this->cartons->id]);
        $scorer = app(RelevanceScorer::class);

        $this->assertSame(45.0, $scorer->score($tender, $this->atlas)); // 30 (IA) + 15 (national)
        $tender->ai_category_id = null;
        $this->assertSame(15.0, $scorer->score($tender, $this->atlas->fresh()));
    }

    private function tender(?User $owner = null, ?Category $category = null): Tender
    {
        $owner ??= $this->buyer;

        return Tender::create([
            'buyer_id' => $owner->buyerProfile->id,
            'title' => 'Cartons',
            'description' => 'Cartons ondulés pour nos expéditions mensuelles.',
            'category_id' => ($category ?? $this->cartons)->id,
            'status' => TenderStatus::OPEN,
        ]);
    }

    private function acceptedQuote(float $amount, ?Category $category = null): void
    {
        Quote::create([
            'tender_id' => $this->tender(category: $category)->id,
            'supplier_id' => $this->atlas->id,
            'amount' => $amount,
            'delivery_days' => 7,
            'status' => QuoteStatus::ACCEPTED,
        ]);
    }

    private function catalogueOrder(float $unitPrice, int $quantity): void
    {
        $product = Product::factory()->published()->for($this->atlas, 'supplier')->create(['category_id' => $this->cartons->id]);
        $orderId = DB::table('orders')->insertGetId([
            'buyer_id' => $this->buyer->buyerProfile->id, 'supplier_id' => $this->atlas->id, 'origin' => 'catalogue',
            'total' => $unitPrice * $quantity, 'created_at' => now(), 'updated_at' => now(),
        ]);
        DB::table('order_items')->insert([
            'order_id' => $orderId, 'product_id' => $product->id, 'label' => $product->title,
            'quantity' => $quantity, 'unit_price' => $unitPrice, 'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    public function test_prix_du_marche_donnees_insuffisantes(): void
    {
        $tender = $this->tender();
        $this->acceptedQuote(1000);
        $this->acceptedQuote(5000, $this->informatique); // autre catégorie : ignoré

        $this->actingAs($this->buyer, 'sanctum')->getJson("/api/buyer/tenders/{$tender->id}/market-price")
            ->assertOk()
            ->assertJsonPath('status', 'insufficient')
            ->assertJsonPath('transactions', 1)
            ->assertJsonPath('min_transactions', 3);

        $this->assertSame(0, AiInteraction::query()->where('feature', AiFeature::PRICE_ESTIMATE)->count());
    }

    public function test_prix_du_marche_fourchette_et_enregistrement(): void
    {
        $tender = $this->tender(category: $this->emballage); // catégorie parente : inclut Cartonnage
        $this->acceptedQuote(1000);
        $this->acceptedQuote(2000);
        $this->acceptedQuote(4000);
        $this->catalogueOrder(1.5, 2000); // 3000 TND
        Quote::create(['tender_id' => $this->tender()->id, 'supplier_id' => $this->djerbaPack->id, 'amount' => 99999, 'delivery_days' => 1, 'status' => QuoteStatus::REJECTED]);

        $url = "/api/buyer/tenders/{$tender->id}/market-price";
        $this->actingAs($this->buyer, 'sanctum')->getJson($url)
            ->assertOk()
            ->assertJsonPath('status', 'ok')
            ->assertJsonPath('transactions', 4)
            ->assertJsonPath('low', 1750)
            ->assertJsonPath('median', 2500)
            ->assertJsonPath('high', 3250)
            ->assertJsonPath('simulated', true);

        $this->actingAs($this->buyer, 'sanctum')->getJson($url)->assertOk();
        $this->assertDatabaseCount('ai_interactions', 1);
        $this->assertDatabaseHas('ai_interactions', ['feature' => AiFeature::PRICE_ESTIMATE->value, 'context' => "tender:{$tender->id}"]);
    }

    public function test_prix_du_marche_reserve_au_proprietaire(): void
    {
        $other = User::factory()->buyer()->create();
        $other->buyerProfile()->create(['organization' => 'Autre']);

        $this->actingAs($other, 'sanctum')->getJson("/api/buyer/tenders/{$this->tender()->id}/market-price")->assertForbidden();
    }
}
