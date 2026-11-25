<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\File;

/**
 * Documentation de l'API accessible depuis l'environnement de démo (SCRUM-91).
 * GET /api/docs : interface Swagger UI ; GET /api/docs/openapi.json : spécification (générée par « php artisan api:docs »).
 */
class ApiDocsController extends Controller
{
    public function ui(): Response
    {
        $spec = url('/api/docs/openapi.json');

        $html = <<<HTML
            <!doctype html>
            <html lang="fr">
              <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>API Marketplace B2B — documentation</title>
                <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css" />
              </head>
              <body>
                <div id="swagger-ui"></div>
                <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
                <script>
                  window.ui = SwaggerUIBundle({ url: "{$spec}", dom_id: "#swagger-ui", persistAuthorization: true, docExpansion: "none" });
                </script>
              </body>
            </html>
            HTML;

        return response($html, 200, ['Content-Type' => 'text/html; charset=utf-8']);
    }

    public function spec(): JsonResponse
    {
        $path = base_path('../docs/api/openapi.json');

        abort_unless(File::exists($path), 404, 'Documentation non générée : lancez « php artisan api:docs ».');

        return response()->json(json_decode(File::get($path), true));
    }
}
