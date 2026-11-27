<?php

namespace Tests\Feature\Supplier;

use App\Enums\QuoteStatus;
use App\Enums\TenderStatus;
use App\Models\Category;
use App\Models\Quote;
use App\Models\Region;
use App\Models\SupplierProfile;
use App\Models\Tender;
use App\Models\TenderRecipient;
use App\Models\User;
use App\Notifications\NewQuoteNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Demandes reçues, envoi d'un devis et suivi des devis (SCRUM-44 à SCRUM-46).
 */
class SupplierQuoteTest extends TestCase
{
    use RefreshDatabase;

    private Category $emballage;

    private Region $tunis;

    private User $buyerUser;

    private SupplierProfile $supplier;

    private Tender $tender;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tunis = Region::create(['name' => 'Tunis']);
        $this->emballage = Category::create(['name' => 'Emballage', 'position' => 1]);

        $this->buyerUser = User::factory()->buyer()->create();
        $this->buyerUser->buyerProfile()->create(['organization' => 'Acheteur']);

        $this->supplier = SupplierProfile::factory()->validated()->create([
            'region_id' => $this->tunis->id,
            'description' => 'Cartons d’emballage sur mesure',
            'rating_avg' => 0,
        ]);
        $this->supplier->categories()->attach($this->emballage->id);

        $this->tender = Tender::create([
            'buyer_id' => $this->buyerUser->buyerProfile->id,
            'title' => 'Cartons d’emballage',
            'description' => 'Besoin de cartons solides pour expédier les commandes.',
            'category_id' => $this->emballage->id,
            'region_id' => $this->tunis->id,
            'status' => TenderStatus::OPEN,
        ]);

        TenderRecipient::create([
            'tender_id' => $this->tender->id,
            'supplier_id' => $this->supplier->id,
            'score' => 82.5,
            'source' => TenderRecipient::SOURCE_AUTOMATIC,
            'notified_at' => now(),
        ]);

        Sanctum::actingAs($this->supplier->user);
    }

    public function test_le_fournisseur_consulte_ses_demandes_triees_par_score_et_marque_comme_vue(): void
    {
        $this->getJson('/api/supplier/tenders')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.score', 82.5)
            ->assertJsonPath('data.0.already_responded', false)
            ->assertJsonPath('data.0.seen_at', null);

        $this->getJson("/api/supplier/tenders/{$this->tender->id}")
            ->assertOk()
            ->assertJsonPath('tender.title', 'Cartons d’emballage');

        $this->assertNotNull(
            TenderRecipient::query()->where('tender_id', $this->tender->id)->value('seen_at')
        );
    }

    public function test_le_fournisseur_destinataire_telecharge_la_piece_jointe_sous_son_nom(): void
    {
        Storage::fake('local');
        Storage::disk('local')->put('tender-attachments/cdc-aleatoire.pdf', '%PDF-1.4');

        $attachment = $this->tender->attachments()->create([
            'file_path' => 'tender-attachments/cdc-aleatoire.pdf',
            'original_name' => 'cahier-des-charges.pdf',
        ]);

        $this->get("/api/supplier/tenders/{$this->tender->id}/attachments/{$attachment->id}")
            ->assertOk()
            ->assertDownload('cahier-des-charges.pdf');

        $otherTender = Tender::create([
            'buyer_id' => $this->buyerUser->buyerProfile->id,
            'title' => 'Autre demande',
            'description' => 'Demande à laquelle le fournisseur n’a pas été invité.',
            'category_id' => $this->emballage->id,
            'region_id' => $this->tunis->id,
            'status' => TenderStatus::OPEN,
        ]);

        $this->get("/api/supplier/tenders/{$otherTender->id}/attachments/{$attachment->id}")
            ->assertNotFound();
    }

    public function test_le_fournisseur_envoie_un_devis_unique_puis_le_modifie(): void
    {
        Notification::fake();

        $this->postJson("/api/supplier/tenders/{$this->tender->id}/quote", [
            'amount' => 2500,
            'delivery_days' => 7,
            'conditions' => 'Livraison franco de port.',
            'comment' => 'Cartons double cannelure.',
        ])
            ->assertCreated()
            ->assertJsonPath('amount', 2500)
            ->assertJsonPath('status', QuoteStatus::SENT->value)
            ->assertJsonPath('can_edit', true);

        $this->assertSame(1, Quote::query()->count());
        Notification::assertSentTo($this->buyerUser, NewQuoteNotification::class);

        $this->putJson("/api/supplier/tenders/{$this->tender->id}/quote", [
            'amount' => 2300,
            'delivery_days' => 5,
        ])
            ->assertOk()
            ->assertJsonPath('amount', 2300)
            ->assertJsonPath('delivery_days', 5);

        $this->assertSame(1, Quote::query()->count());
        $this->assertSame(2300.0, (float) Quote::query()->first()->amount);
    }

    public function test_un_fournisseur_qui_n_est_pas_destinataire_ne_peut_pas_envoyer_de_devis(): void
    {
        $other = SupplierProfile::factory()->validated()->create(['region_id' => $this->tunis->id]);
        $other->categories()->attach($this->emballage->id);
        Sanctum::actingAs($other->user);

        $this->postJson("/api/supplier/tenders/{$this->tender->id}/quote", [
            'amount' => 1000,
            'delivery_days' => 3,
        ])->assertForbidden();
    }

    public function test_aucun_devis_n_est_accepte_sur_une_demande_cloturee_ou_annulee(): void
    {
        $this->tender->update(['status' => TenderStatus::CLOSED]);

        $this->postJson("/api/supplier/tenders/{$this->tender->id}/quote", [
            'amount' => 1000,
            'delivery_days' => 3,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['tender']);
    }

    public function test_un_devis_accepte_ne_peut_plus_etre_modifie(): void
    {
        Quote::create([
            'tender_id' => $this->tender->id,
            'supplier_id' => $this->supplier->id,
            'amount' => 1000,
            'delivery_days' => 3,
            'status' => QuoteStatus::ACCEPTED,
        ]);

        $this->putJson("/api/supplier/tenders/{$this->tender->id}/quote", [
            'amount' => 900,
            'delivery_days' => 2,
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['tender']);
    }

    public function test_le_fournisseur_filtre_ses_devis_par_statut(): void
    {
        $otherTender = Tender::create([
            'buyer_id' => $this->buyerUser->buyerProfile->id,
            'title' => 'Autre demande',
            'description' => 'Une autre demande pour tester le filtre par statut.',
            'category_id' => $this->emballage->id,
            'region_id' => $this->tunis->id,
            'status' => TenderStatus::CLOSED,
        ]);

        Quote::create([
            'tender_id' => $this->tender->id,
            'supplier_id' => $this->supplier->id,
            'amount' => 1000,
            'delivery_days' => 3,
            'status' => QuoteStatus::SENT,
        ]);
        Quote::create([
            'tender_id' => $otherTender->id,
            'supplier_id' => $this->supplier->id,
            'amount' => 2000,
            'delivery_days' => 6,
            'status' => QuoteStatus::REJECTED,
        ]);

        $this->getJson('/api/supplier/quotes?status='.QuoteStatus::REJECTED->value)
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.status', QuoteStatus::REJECTED->value);
    }

    public function test_un_fournisseur_en_attente_ne_peut_pas_acceder_aux_demandes(): void
    {
        $pending = SupplierProfile::factory()->pending()->create(['region_id' => $this->tunis->id]);
        $pending->categories()->attach($this->emballage->id);
        Sanctum::actingAs($pending->user);

        $this->getJson('/api/supplier/tenders')->assertForbidden();
    }

    public function test_un_porteur_ne_peut_pas_acceder_aux_demandes_fournisseur(): void
    {
        Sanctum::actingAs($this->buyerUser);

        $this->getJson('/api/supplier/tenders')->assertForbidden();
    }
}
