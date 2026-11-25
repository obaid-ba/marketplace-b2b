<?php

use App\Http\Middleware\EnsureEmailIsVerified;
use App\Http\Middleware\EnsureSupplierIsValidated;
use App\Http\Middleware\EnsureUserHasRole;
use App\Http\Middleware\SecurityHeaders;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    // Temps réel : POST /api/broadcasting/auth, avec le même jeton Bearer que l'API.
    ->withBroadcasting(
        __DIR__.'/../routes/channels.php',
        ['prefix' => 'api', 'middleware' => ['auth:sanctum']],
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Usage dans les routes : ->middleware('role:supplier') ou 'role:admin,buyer'
        // 'supplier.validated' : pages de vente réservées aux fournisseurs validés (SCRUM-27).
        // En-têtes de sécurité sur toutes les réponses de l'API (SCRUM-90).
        $middleware->appendToGroup('api', SecurityHeaders::class);

        $middleware->alias([
            'role' => EnsureUserHasRole::class,
            'verified' => EnsureEmailIsVerified::class,
            'supplier.validated' => EnsureSupplierIsValidated::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // L'API répond toujours en JSON, même pour les erreurs.
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson()
        );

        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['message' => 'Non authentifié.'], 401);
            }
        });

        // Réponses d'erreur JSON uniformes, en français (SCRUM-127 / SCRUM-92) : { message, errors? }.
        // Un message français déjà fourni par le code (abort(403, '…'), ValidationException…) est conservé.
        $exceptions->render(function (ValidationException $e, Request $request) {
            if ($request->is('api/*')) {
                $errors = $e->errors();

                return response()->json([
                    'message' => collect($errors)->flatten()->first() ?? 'Certains champs sont invalides.',
                    'errors' => $errors,
                ], $e->status);
            }
        });

        $exceptions->render(function (HttpExceptionInterface $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            $status = $e->getStatusCode();
            $message = $e->getMessage();
            $isDefault = $message === '' || preg_match('/^(No query results|The route|This action is unauthorized|Too Many Attempts|The .* method is not supported)/i', $message);

            $defaults = [
                403 => 'Vous n’avez pas accès à cette ressource.',
                404 => 'Ressource introuvable.',
                405 => 'Cette action n’est pas disponible à cette adresse.',
                429 => 'Trop de requêtes. Réessayez dans quelques instants.',
            ];

            if (! $isDefault || ! isset($defaults[$status])) {
                return null; // message métier déjà rédigé : rendu standard de Laravel
            }

            $body = ['message' => $defaults[$status]];
            if ($status === 429 && isset($e->getHeaders()['Retry-After'])) {
                $body['retry_after'] = (int) $e->getHeaders()['Retry-After'];
                $body['message'] = 'Trop de requêtes. Réessayez dans '.$body['retry_after'].' s.';
            }

            return response()->json($body, $status, $e->getHeaders());
        });

        // Erreur imprévue en production : jamais de trace technique, un message clair.
        $exceptions->render(function (Throwable $e, Request $request) {
            if ($request->is('api/*') && ! config('app.debug') && ! $e instanceof HttpExceptionInterface) {
                return response()->json(['message' => 'Une erreur interne est survenue. Réessayez dans quelques instants.'], 500);
            }
        });
    })->create();
