<?php

namespace Tests\Feature\Tender;

use App\Enums\TenderStatus;
use App\Enums\UserStatus;
use App\Jobs\DiffuseTenderJob;
use App\Models\Category;
use App\Models\Region;
use App\Models\SupplierProfile;
use App\Models\Tender;
use App\Models\TenderRecipient;
use App\Models\User;
use App\Notifications\TenderReceivedNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Diffusion automatique d'une demande et score de pertinence (SCRUM-42 / SCRUM-50).
 */
class TenderDiffusionTest extends TestCase
{
    use RefreshDatabase;

    private Category $emballage;

    private Region $tunis;

    private Region $sfax;

    private User $buyerUser;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tunis = Region::create(['name' => 'Tunis']);
        $this->sfax = Region::create(['name' => 'Sfax']);
        $this->emballage = Category::create(['name' => 'Emballage', 'position' => 1]);
        Category::create(['name' => 'Logistique', 'position' => 2]);

        $this->buyerUser = User::factory()->buyer()->create();
        $this->buyerUser->buyerProfile()->create(['organization' => 'Acheteur']);
    }

    public function test_la_diffusion_cible_les_fournisseurs_valides_de_la_categorie_et_de_la_region(): void
    {
        Notification::fake();

        $matching = $this->supplier($this->tunis, 'Emballage carton sur mesure');
        $coverage = $this->supplier($this->sfax, 'Emballage industriel');
        $coverage->coverageRegions()->attach($this->tunis->id);

        $wrongRegion = $this->supplier($this->sfax, 'Emballage carton');
        $pending = SupplierProfile::factory()->pending()->create(['region_id' => $this->tunis->id]);
        $pending->categories()->attach($this->emballage->id);
        $suspended = $this->supplier($this->tunis, 'Emballage');
        $suspended->user->update(['status' => UserStatus::SUSPENDED]);

        $tender = $this->publish();

        $recipients = TenderRecipient::query()->orderByDesc('score')->get();

        $this->assertCount(2, $recipients);
        $this->assertEqualsCanonicalizing(
            [$matching->id, $coverage->id],
            $recipients->pluck('supplier_id')->all(),
        );
        $this->assertFalse($recipients->pluck('supplier_id')->contains($wrongRegion->id));
        $this->assertFalse($recipients->pluck('supplier_id')->contains($pending->id));
        $this->assertFalse($recipients->pluck('supplier_id')->contains($suspended->id));

        $this->assertSame(TenderRecipient::SOURCE_AUTOMATIC, $recipients->first()->source);
        $this->assertNotNull($recipients->first()->notified_at);
        $this->assertGreaterThan(0, (float) $recipients->first()->score);

        Notification::assertSentTo($matching->user, TenderReceivedNotification::class);
        Notification::assertSentTo($coverage->user, TenderReceivedNotification::class);
        Notification::assertNotSentTo($wrongRegion->user, TenderReceivedNotification::class);
    }

    public function test_les_fournisseurs_sont_tries_par_score_de_pertinence(): void
    {
        $strong = $this->supplier($this->tunis, 'Cartons d’emballage sur mesure pour expéditions');
        $weak = $this->supplier($this->tunis, 'Service de nettoyage');

        $this->publish();

        $this->assertGreaterThan(
            (float) TenderRecipient::query()->where('supplier_id', $weak->id)->value('score'),
            (float) TenderRecipient::query()->where('supplier_id', $strong->id)->value('score'),
        );
    }

    public function test_une_demande_fermee_n_est_pas_diffusee(): void
    {
        Notification::fake();
        $supplier = $this->supplier($this->tunis, 'Emballage');

        $tender = Tender::create([
            'buyer_id' => $this->buyerUser->buyerProfile->id,
            'title' => 'Demande clôturée',
            'description' => 'Cette demande est déjà clôturée et ne doit pas être diffusée.',
            'category_id' => $this->emballage->id,
            'region_id' => $this->tunis->id,
            'status' => TenderStatus::CLOSED,
        ]);

        (new DiffuseTenderJob($tender->id))->handle(app(\App\Services\RelevanceScorer::class));

        $this->assertDatabaseCount('tender_recipients', 0);
        Notification::assertNothingSentTo($supplier->user);
    }

    private function publish(): Tender
    {
        Sanctum::actingAs($this->buyerUser);

        $this->postJson('/api/buyer/tenders', [
            'title' => 'Cartons d’emballage sur mesure',
            'description' => 'Nous recherchons des cartons d’emballage solides pour expédier nos produits.',
            'category_id' => $this->emballage->id,
            'region_id' => $this->tunis->id,
        ])->assertCreated();

        return Tender::query()->latest('id')->firstOrFail();
    }

    private function supplier(Region $region, string $description): SupplierProfile
    {
        $supplier = SupplierProfile::factory()->validated()->create([
            'region_id' => $region->id,
            'description' => $description,
        ]);
        $supplier->categories()->attach($this->emballage->id);

        return $supplier;
    }
}
