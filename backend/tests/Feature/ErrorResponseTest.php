<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * Réponses d'erreur JSON uniformes en français et en-têtes de cache publics (SCRUM-127 / SCRUM-92).
 */
class ErrorResponseTest extends TestCase
{
    use RefreshDatabase;

    public function test_404_en_francais_pour_une_ressource_ou_une_adresse_inconnue(): void
    {
        $this->getJson('/api/produits-inexistants')->assertNotFound()->assertExactJson(['message' => 'Ressource introuvable.']);
        $this->getJson('/api/products/999999')->assertNotFound()->assertJsonPath('message', fn (string $message) => ! str_contains($message, 'No query results'));
    }

    public function test_403_en_francais(): void
    {
        $this->actingAs(User::factory()->buyer()->create(), 'sanctum')
            ->getJson('/api/admin/dashboard')
            ->assertForbidden()
            ->assertJsonStructure(['message']);
    }

    public function test_422_premier_message_et_details_par_champ(): void
    {
        $this->actingAs(User::factory()->buyer()->create(), 'sanctum')
            ->postJson('/api/buyer/tenders', [])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'Le titre de la demande est obligatoire.')
            ->assertJsonValidationErrors(['title', 'description', 'category_id']);
    }

    public function test_429_indique_le_delai(): void
    {
        Route::middleware('throttle:1,1')->get('/api/test-throttle', fn () => ['ok' => true]);

        $this->getJson('/api/test-throttle')->assertOk();
        $this->getJson('/api/test-throttle')
            ->assertStatus(429)
            ->assertJson(fn ($json) => $json->where('message', fn (string $message) => str_starts_with($message, 'Trop de requêtes. Réessayez dans'))->has('retry_after'));
    }

    public function test_500_sans_detail_technique_en_production(): void
    {
        config(['app.debug' => false]);
        Route::get('/api/test-crash', fn () => throw new \RuntimeException('SQLSTATE secret'));

        $this->getJson('/api/test-crash')
            ->assertStatus(500)
            ->assertExactJson(['message' => 'Une erreur interne est survenue. Réessayez dans quelques instants.']);
    }

    public function test_les_ressources_publiques_sont_mises_en_cache(): void
    {
        $this->getJson('/api/categories')->assertOk()->assertHeader('ETag');
        $this->assertStringContainsString('max-age=300', $this->getJson('/api/home')->headers->get('Cache-Control'));
        $this->assertStringContainsString('public', $this->getJson('/api/reference/regions')->headers->get('Cache-Control'));
    }
}
