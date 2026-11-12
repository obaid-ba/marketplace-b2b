<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\EmailVerificationController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Routes de l'API (préfixe /api)
|--------------------------------------------------------------------------
| Authentification par jeton Bearer (Laravel Sanctum), utilisable par
| l'application web et par l'application mobile.
| Chaque groupe de routes métier est protégé par le middleware "role".
*/

Route::post('/auth/login', [AuthController::class, 'login'])
    ->middleware('throttle:login');

// Lien reçu par e-mail : pas besoin d'être connecté, la signature du lien suffit (SCRUM-24).
Route::get('/auth/email/verify/{id}/{hash}', [EmailVerificationController::class, 'verify'])
    ->whereNumber('id')
    ->middleware('throttle:6,1')
    ->name('verification.verify');

Route::middleware('auth:sanctum')->group(function () {
    // Accessibles même si l'e-mail n'est pas encore vérifié.
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::post('/auth/email/resend', [EmailVerificationController::class, 'resend'])
        ->middleware('throttle:verification-resend');
});

// Espaces métier : connecté ET adresse e-mail vérifiée.
Route::middleware(['auth:sanctum', 'verified'])->group(function () {
    // Espace fournisseur (S2+) : produits, demandes reçues, devis…
    Route::middleware('role:supplier')->prefix('supplier')->group(function () {
        Route::get('/ping', fn () => ['space' => 'supplier']);
    });

    // Espace porteur de projet (S3+) : demandes, comparaison des devis, commandes…
    Route::middleware('role:buyer')->prefix('buyer')->group(function () {
        Route::get('/ping', fn () => ['space' => 'buyer']);
    });

    // Back-office (S1+) : validation des fournisseurs, catégories, litiges…
    Route::middleware('role:admin')->prefix('admin')->group(function () {
        Route::get('/ping', fn () => ['space' => 'admin']);
    });
});
