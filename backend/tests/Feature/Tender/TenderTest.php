<?php

namespace Tests\Feature\Tender;

use App\Enums\QuoteStatus;
use App\Enums\TenderStatus;
use App\Jobs\DiffuseTenderJob;
use App\Models\Category;
use App\Models\Favorite;
use App\Models\Quote;
use App\Models\Region;
use App\Models\SupplierProfile;
use App\Models\Tender;
use App\Models\TenderRecipient;
use App\Models\User;
use App\Notifications\TenderCancelledNotification;
use App\Notifications\TenderReceivedNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Publication, suivi, annulation et invitation sur une demande (SCRUM-41, SCRUM-43, SCRUM-49).
 */
class TenderTest extends TestCase
{
    use RefreshDatabase;

    private User $buyerUser;

    private Category $emballage;

    private Region $tunis;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');

        $this->tunis = Region::create(['name' => 'Tunis']);
        $this->emballage = Category::create(['name' => 'Emballage', 'position' => 1]);

        $this->buyerUser = User::factory()->buyer()->create();
        $this->buyerUser->buyerProfile()->create(['organization' => 'Entreprise Acheteuse']);

        Sanctum::actingAs($this->buyerUser);
    }

    public function test_un_porteur_publie_une_demande_et_la_diffusion_est_mise_en_file(): void
    {
        Queue::fake();

        $this->post('/api/buyer/tenders', [
            'title' => 'Cartons d’emballage sur mesure',
            'description' => 'Nous cherchons un fournisseur de cartons solides pour expédier nos produits.',
            'category_id' => $this->emballage->id,
            'region_id' => $this->tunis->id,
            'budget' => 4500,
            'desired_deadline' => now()->addDays(20)->toDateString(),
            'attachments' => [UploadedFile::fake()->create('cahier-des-charges.pdf', 120, 'application/pdf')],
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->assertJsonPath('title', 'Cartons d’emballage sur mesure')
            ->assertJsonPath('status', TenderStatus::OPEN->value)
            ->assertJsonPath('attachments.0.name', 'cahier-des-charges.pdf')
            ->assertJsonPath('category.name', 'Emballage');

        $tender = Tender::query()->firstOrFail();

        $this->assertSame(1, $tender->attachments()->count());
        $this->assertSame('cahier-des-charges.pdf', $tender->attachments()->first()->original_name);
        Queue::assertPushed(DiffuseTenderJob::class, fn (DiffuseTenderJob $job) => $job->tenderId === $tender->id);
    }

    public function test_le_porteur_telecharge_la_piece_jointe_sous_son_nom_d_origine(): void
    {
        Queue::fake();
        Storage::fake('local');

        $tenderId = $this->post('/api/buyer/tenders', [
            'title' => 'Cartons d’emballage sur mesure',
            'description' => 'Nous cherchons un fournisseur de cartons solides pour expédier nos produits.',
            'category_id' => $this->emballage->id,
            'region_id' => $this->tunis->id,
            'budget' => 4500,
            'desired_deadline' => now()->addDays(20)->toDateString(),
            'attachments' => [UploadedFile::fake()->create('cahier-des-charges.pdf', 120, 'application/pdf')],
        ], ['Accept' => 'application/json'])
            ->assertCreated()
            ->json('id');

        $attachment = Tender::query()->findOrFail($tenderId)->attachments()->firstOrFail();

        $this->get("/api/buyer/tenders/{$tenderId}/attachments/{$attachment->id}")
            ->assertOk()
            ->assertDownload('cahier-des-charges.pdf');

        // Une pièce jointe d'une autre demande reste introuvable.
        $this->get("/api/buyer/tenders/999/attachments/{$attachment->id}")
            ->assertNotFound();
    }

    public function test_la_date_limite_doit_etre_future_et_les_champs_obligatoires_presents(): void
    {
        $this->postJson('/api/buyer/tenders', [
            'title' => 'A',
            'description' => 'Trop court',
            'category_id' => 999,
            'desired_deadline' => now()->subDay()->toDateString(),
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['title', 'description', 'category_id', 'desired_deadline']);
    }

    public function test_un_porteur_ne_voit_que_ses_propres_demandes(): void
    {
        $this->tender($this->buyerUser, ['title' => 'Ma demande']);

        $other = User::factory()->buyer()->create();
        $other->buyerProfile()->create(['organization' => 'Autre acheteur']);
        $this->tender($other, ['title' => 'Demande des autres']);

        $this->getJson('/api/buyer/tenders')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Ma demande');
    }

    public function test_un_porteur_annule_sa_demande_et_previent_les_fournisseurs_ayant_repondu(): void
    {
        Notification::fake();

        $tender = $this->tender($this->buyerUser);
        $supplier = $this->supplier();
        $supplier->user->notify(new TenderReceivedNotification($tender));

        Quote::create([
            'tender_id' => $tender->id,
            'supplier_id' => $supplier->id,
            'amount' => 1200,
            'delivery_days' => 5,
            'status' => QuoteStatus::SENT,
        ]);

        $this->postJson("/api/buyer/tenders/{$tender->id}/cancel")
            ->assertOk()
            ->assertJsonPath('status', TenderStatus::CANCELLED->value);

        Notification::assertSentTo($supplier->user, TenderCancelledNotification::class);
    }

    public function test_un_porteur_ne_peut_pas_annuler_la_demande_d_un_autre(): void
    {
        $other = User::factory()->buyer()->create();
        $other->buyerProfile()->create(['organization' => 'Autre']);
        $tender = $this->tender($other);

        $this->postJson("/api/buyer/tenders/{$tender->id}/cancel")->assertForbidden();
        $this->assertSame(TenderStatus::OPEN, $tender->refresh()->status);
    }

    public function test_un_porteur_invite_un_fournisseur_favori_et_une_seule_notification_est_envoyee(): void
    {
        Notification::fake();

        $tender = $this->tender($this->buyerUser);
        $supplier = $this->supplier();

        Favorite::create([
            'buyer_id' => $this->buyerUser->buyerProfile->id,
            'supplier_id' => $supplier->id,
        ]);

        $this->getJson("/api/buyer/favorites?tender_id={$tender->id}")
            ->assertOk()
            ->assertJsonPath('0.id', $supplier->id)
            ->assertJsonPath('0.invited', false);

        $this->postJson("/api/buyer/tenders/{$tender->id}/invite", ['supplier_id' => $supplier->id])
            ->assertOk()
            ->assertJsonPath('recipient.source', TenderRecipient::SOURCE_INVITED);

        Notification::assertSentToTimes($supplier->user, TenderReceivedNotification::class, 1);

        $this->postJson("/api/buyer/tenders/{$tender->id}/invite", ['supplier_id' => $supplier->id])
            ->assertOk();

        $this->assertSame(1, TenderRecipient::query()->count());
        Notification::assertSentToTimes($supplier->user, TenderReceivedNotification::class, 1);
    }

    public function test_un_fournisseur_non_valide_ne_peut_pas_etre_invite(): void
    {
        $tender = $this->tender($this->buyerUser);
        $supplier = SupplierProfile::factory()->pending()->create();

        $this->postJson("/api/buyer/tenders/{$tender->id}/invite", ['supplier_id' => $supplier->id])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['supplier_id']);
    }

    public function test_un_fournisseur_ne_peut_pas_publier_une_demande(): void
    {
        Sanctum::actingAs(User::factory()->supplier()->create());

        $this->postJson('/api/buyer/tenders', [
            'title' => 'Demande fournisseur',
            'description' => 'Un fournisseur ne publie pas de demande.',
            'category_id' => $this->emballage->id,
        ])->assertForbidden();
    }

    private function supplier(): SupplierProfile
    {
        $supplier = SupplierProfile::factory()->validated()->create(['region_id' => $this->tunis->id]);
        $supplier->categories()->attach($this->emballage->id);

        return $supplier;
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function tender(User $user, array $attributes = []): Tender
    {
        return Tender::create(array_merge([
            'buyer_id' => $user->buyerProfile->id,
            'title' => 'Demande de cartons',
            'description' => 'Besoin de cartons pour expédier les commandes de la boutique.',
            'category_id' => $this->emballage->id,
            'region_id' => $this->tunis->id,
            'status' => TenderStatus::OPEN,
        ], $attributes));
    }
}
