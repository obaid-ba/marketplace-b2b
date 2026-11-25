<?php

namespace Tests\Feature\Security;

use App\Models\Category;
use App\Models\Order;
use App\Models\Product;
use App\Models\Quote;
use App\Models\SupplierProfile;
use App\Models\Tender;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Vérifier la sécurité et la confidentialité (SCRUM-90 / F34) : aucun accès aux données d'un autre utilisateur
 * (IDOR), fichiers privés, mots de passe hachés, limitation de débit (connexion, IA), en-têtes de sécurité.
 */
class SecurityAuditTest extends TestCase
{
    use RefreshDatabase;

    private User $buyer;

    private User $otherBuyer;

    private SupplierProfile $supplier;

    private SupplierProfile $otherSupplier;

    private Tender $tender;

    private Quote $quote;

    private Order $order;

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();
        Storage::fake('local');
        Storage::fake('public');

        $category = Category::create(['name' => 'Emballage', 'position' => 1]);
        $this->supplier = SupplierProfile::factory()->visible()->create();
        $this->supplier->categories()->attach($category->id);
        $this->otherSupplier = SupplierProfile::factory()->visible()->create();

        $this->buyer = User::factory()->buyer()->create();
        $this->buyer->buyerProfile()->create(['organization' => 'A']);
        $this->otherBuyer = User::factory()->buyer()->create();
        $this->otherBuyer->buyerProfile()->create(['organization' => 'B']);

        $tenderId = $this->actingAs($this->buyer, 'sanctum')->post('/api/buyer/tenders', [
            'title' => 'Cartons confidentiels',
            'description' => 'Besoin confidentiel de cartons pour un nouveau produit, avec cahier des charges.',
            'category_id' => $category->id,
            'attachments' => [UploadedFile::fake()->create('cahier.pdf', 50, 'application/pdf')],
        ], ['Accept' => 'application/json'])->assertCreated()->json('id');
        $this->tender = Tender::findOrFail($tenderId);

        $this->actingAs($this->supplier->user, 'sanctum')
            ->postJson("/api/supplier/tenders/{$tenderId}/quote", ['amount' => 1000, 'delivery_days' => 5])
            ->assertCreated();
        $this->quote = Quote::query()->firstOrFail();
        $this->order = Order::findOrFail(
            $this->actingAs($this->buyer, 'sanctum')->postJson("/api/buyer/quotes/{$this->quote->id}/accept")->assertCreated()->json('id')
        );
    }

    private function assertDenied(TestResponse $response): void
    {
        $this->assertContains($response->status(), [403, 404], "Accès accordé à tort : {$response->status()}");
        $this->assertStringNotContainsString('Cartons confidentiels', $response->getContent());
    }

    public function test_un_porteur_n_accede_a_aucune_donnee_d_un_autre_porteur(): void
    {
        $this->actingAs($this->otherBuyer, 'sanctum');

        $this->assertDenied($this->getJson("/api/buyer/tenders/{$this->tender->id}"));
        $this->assertDenied($this->getJson("/api/buyer/tenders/{$this->tender->id}/quotes"));
        $this->assertDenied($this->getJson("/api/buyer/tenders/{$this->tender->id}/quotes/summary"));
        $this->assertDenied($this->getJson("/api/buyer/tenders/{$this->tender->id}/market-price"));
        $this->assertDenied($this->getJson("/api/buyer/tenders/{$this->tender->id}/attachments/{$this->tender->attachments()->first()->id}"));
        $this->assertDenied($this->postJson("/api/buyer/tenders/{$this->tender->id}/cancel"));
        $this->assertDenied($this->postJson("/api/buyer/quotes/{$this->quote->id}/accept"));
        $this->assertDenied($this->getJson("/api/buyer/orders/{$this->order->id}"));
        $this->assertDenied($this->getJson("/api/orders/{$this->order->id}"));
        $this->assertDenied($this->postJson("/api/buyer/orders/{$this->order->id}/confirm-receipt"));
        $this->assertDenied($this->postJson("/api/buyer/orders/{$this->order->id}/review", ['rating' => 1]));

        $document = DB::table('documents')->where('order_id', $this->order->id)->value('id');
        if ($document) {
            $this->assertDenied($this->getJson("/api/documents/{$document}/download"));
            $this->assertDenied($this->getJson("/api/orders/{$this->order->id}/documents/{$document}/download"));
        }
    }

    public function test_un_fournisseur_n_accede_ni_aux_demandes_ni_aux_commandes_des_autres(): void
    {
        $product = Product::factory()->published()->for($this->supplier, 'supplier')->create();
        $this->actingAs($this->otherSupplier->user, 'sanctum');

        $this->assertDenied($this->getJson("/api/supplier/tenders/{$this->tender->id}")); // non destinataire
        $this->assertDenied($this->postJson("/api/supplier/tenders/{$this->tender->id}/quote", ['amount' => 1, 'delivery_days' => 1]));
        $this->assertDenied($this->postJson("/api/supplier/orders/{$this->order->id}/advance"));
        $this->assertDenied($this->getJson("/api/supplier/products/{$product->id}"));
        $this->assertDenied($this->putJson("/api/supplier/products/{$product->id}", ['title' => 'Piraté']));
        $this->assertDenied($this->deleteJson("/api/supplier/products/{$product->id}"));
        $this->assertDenied($this->postJson("/api/supplier/products/{$product->id}/feature", ['days' => 7]));
        $this->assertNotSame('Piraté', $product->fresh()->title);
    }

    public function test_une_suggestion_ia_d_un_autre_utilisateur_est_introuvable(): void
    {
        $interaction = $this->actingAs($this->buyer, 'sanctum')
            ->postJson('/api/chatbot/messages', ['conversation_id' => (string) Str::uuid(), 'message' => 'Comment payer ?'])
            ->assertOk()
            ->json('interaction_id');

        $this->actingAs($this->otherBuyer, 'sanctum')->postJson("/api/ai/interactions/{$interaction}/accept")->assertNotFound();
    }

    public function test_les_fichiers_televerses_restent_prives(): void
    {
        $path = $this->tender->attachments()->first()->file_path;

        Storage::disk('local')->assertExists($path);
        Storage::disk('public')->assertMissing($path);
        $this->assertDenied($this->get('/storage/'.$path, ['Accept' => 'application/json']));
    }

    public function test_les_mots_de_passe_sont_haches(): void
    {
        $this->postJson('/api/auth/register/buyer', [
            'first_name' => 'Sana', 'last_name' => 'Test', 'email' => 'sana.secu@test.tn', 'phone' => '22123456',
            'password' => 'Motdepasse1!', 'password_confirmation' => 'Motdepasse1!',
        ]);
        $stored = DB::table('users')->where('email', 'sana.secu@test.tn')->value('password')
            ?? DB::table('users')->where('id', $this->buyer->id)->value('password');

        $this->assertNotSame('Motdepasse1!', $stored);
        $this->assertTrue(Hash::isHashed($stored));
    }

    public function test_limitation_de_debit_sur_la_connexion_et_l_ia(): void
    {
        foreach (range(1, 5) as $attempt) {
            $this->postJson('/api/auth/login', ['email' => $this->buyer->email, 'password' => 'mauvais'])->assertStatus(422);
        }
        $this->postJson('/api/auth/login', ['email' => $this->buyer->email, 'password' => 'mauvais'])->assertStatus(429);

        config(['ai.rate_limit' => 1]);
        $ask = fn () => $this->actingAs($this->otherBuyer, 'sanctum')
            ->postJson('/api/chatbot/messages', ['conversation_id' => (string) Str::uuid(), 'message' => 'Comment publier une demande ?']);
        $ask()->assertOk();
        $ask()->assertStatus(429);
    }

    public function test_en_tetes_de_securite_sur_l_api(): void
    {
        $this->getJson('/api/categories')
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('X-Frame-Options', 'DENY')
            ->assertHeader('Referrer-Policy', 'no-referrer')
            ->assertHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    }
}
