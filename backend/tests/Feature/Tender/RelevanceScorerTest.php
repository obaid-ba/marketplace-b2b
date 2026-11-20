<?php

namespace Tests\Feature\Tender;

use App\Enums\TenderStatus;
use App\Models\Category;
use App\Models\Region;
use App\Models\SupplierProfile;
use App\Models\Tender;
use App\Services\RelevanceScorer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Score de pertinence v1 : catégorie, région, mots-clés (SCRUM-50).
 */
class RelevanceScorerTest extends TestCase
{
    use RefreshDatabase;

    private Region $tunis;

    private Region $sfax;

    private Category $emballage;

    private Category $logistique;

    private RelevanceScorer $scorer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tunis = Region::create(['name' => 'Tunis']);
        $this->sfax = Region::create(['name' => 'Sfax']);
        $this->emballage = Category::create(['name' => 'Emballage', 'position' => 1]);
        $this->logistique = Category::create(['name' => 'Logistique', 'position' => 2]);

        $this->scorer = app(RelevanceScorer::class);
    }

    public function test_un_fournisseur_de_la_meme_categorie_et_region_obtient_un_score_eleve(): void
    {
        $supplier = SupplierProfile::factory()->validated()->create([
            'region_id' => $this->tunis->id,
            'description' => 'Fabrication de cartons et emballages sur mesure.',
        ]);
        $supplier->categories()->attach($this->emballage->id);

        $tender = $this->tender([
            'title' => 'Fourniture de cartons d’emballage sur mesure',
            'description' => 'Nous cherchons un fabricant de cartons et emballages sur mesure pour nos expéditions.',
            'region_id' => $this->tunis->id,
        ]);

        $score = $this->scorer->score($tender, $supplier);

        $this->assertGreaterThanOrEqual(80, $score);
        $this->assertLessThanOrEqual(100, $score);
    }

    public function test_un_fournisseur_hors_categorie_et_hors_region_obtient_un_score_faible(): void
    {
        $supplier = SupplierProfile::factory()->validated()->create([
            'region_id' => $this->sfax->id,
            'description' => 'Transport routier et gestion d’entrepôts.',
        ]);
        $supplier->categories()->attach($this->logistique->id);

        $tender = $this->tender([
            'title' => 'Cartons d’emballage',
            'description' => 'Besoin de cartons solides pour expédier des produits fragiles.',
            'region_id' => $this->tunis->id,
        ]);

        $this->assertLessThan(40, $this->scorer->score($tender, $supplier));
    }

    public function test_une_zone_de_couverture_compte_presque_comme_la_region_du_siege(): void
    {
        $supplier = SupplierProfile::factory()->validated()->create([
            'region_id' => $this->sfax->id,
            'description' => 'Emballage industriel.',
        ]);
        $supplier->categories()->attach($this->emballage->id);
        $supplier->coverageRegions()->attach($this->tunis->id);

        $tender = $this->tender([
            'title' => 'Emballage industriel',
            'description' => 'Emballage industriel pour une nouvelle ligne de production.',
            'region_id' => $this->tunis->id,
        ]);

        $score = $this->scorer->score($tender, $supplier);

        $this->assertGreaterThanOrEqual(75, $score);
    }

    public function test_une_demande_nationale_ajoute_un_bonus_de_region(): void
    {
        $supplier = SupplierProfile::factory()->validated()->create([
            'region_id' => $this->sfax->id,
            'description' => 'Emballage.',
        ]);
        $supplier->categories()->attach($this->emballage->id);

        $tender = $this->tender([
            'title' => 'Emballage national',
            'description' => 'Demande nationale pour de l’emballage.',
            'region_id' => null,
        ]);

        $this->assertGreaterThanOrEqual(65, $this->scorer->score($tender, $supplier));
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function tender(array $attributes): Tender
    {
        $buyer = \App\Models\User::factory()->buyer()->create();
        $profile = $buyer->buyerProfile()->create(['organization' => 'Acheteur']);

        return Tender::create(array_merge([
            'buyer_id' => $profile->id,
            'category_id' => $this->emballage->id,
            'status' => TenderStatus::OPEN,
        ], $attributes));
    }
}
