<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\File;
use Tests\TestCase;

/**
 * Documentation de l'API (SCRUM-91) : générée à partir des routes, accessible depuis la démo.
 */
class ApiDocsTest extends TestCase
{
    public function test_la_documentation_couvre_toutes_les_routes_avec_roles_parametres_et_erreurs(): void
    {
        $directory = storage_path('framework/testing/api-docs');
        File::deleteDirectory($directory);

        $this->artisan('api:docs', ['--path' => $directory])->assertSuccessful();

        $spec = json_decode(File::get("{$directory}/openapi.json"), true);
        $apiRoutes = collect(app('router')->getRoutes()->getRoutes())
            ->filter(fn ($route) => str_starts_with($route->uri(), 'api/') && $route->getActionName() !== 'Closure')
            ->map(fn ($route) => '/'.$route->uri())
            ->unique();

        foreach ($apiRoutes as $path) {
            $this->assertArrayHasKey($path, $spec['paths'], "Route non documentée : {$path}");
        }

        $publish = $spec['paths']['/api/buyer/tenders']['post'];
        $this->assertStringContainsString('porteur de projet', $publish['description']);
        $this->assertContains('title', $publish['requestBody']['content']['multipart/form-data']['schema']['required']);
        $this->assertArrayHasKey('422', $publish['responses']);
        $this->assertArrayHasKey('403', $publish['responses']);
        $this->assertSame([], $spec['paths']['/api/auth/login']['post']['security']);

        $postman = json_decode(File::get("{$directory}/postman_collection.json"), true);
        $this->assertSame('Marketplace B2B', $postman['info']['name']);
        $this->assertNotEmpty($postman['item']);

        File::deleteDirectory($directory);
    }

    public function test_swagger_accessible_depuis_la_demo(): void
    {
        $this->get('/api/docs')->assertOk()->assertSee('swagger-ui', false);
        $this->getJson('/api/docs/openapi.json')->assertOk()->assertJsonPath('info.title', 'API Marketplace B2B');
    }
}
