<?php

use App\Http\Controllers\Api\Admin\SupplierValidationController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BuyerRegistrationController;
use App\Http\Controllers\Api\EmailVerificationController;
use App\Http\Controllers\Api\PasswordResetController;
use App\Http\Controllers\Api\ReferenceController;
use App\Http\Controllers\Api\Supplier\SupplierDocumentController;
use App\Http\Controllers\Api\Supplier\SupplierProfileController;
use App\Http\Controllers\Api\Supplier\SupplierValidationStatusController;
use App\Http\Controllers\Api\SupplierRegistrationController;
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

// Mot de passe oublié (SCRUM-26).
Route::post('/auth/forgot-password', [PasswordResetController::class, 'forgot'])
    ->middleware('throttle:forgot-password');
Route::post('/auth/reset-password', [PasswordResetController::class, 'reset'])
    ->middleware('throttle:6,1');

// Inscription fournisseur en trois étapes (SCRUM-22).
Route::post('/auth/register/supplier', [SupplierRegistrationController::class, 'store'])
    ->middleware('throttle:register');
Route::post('/auth/register/supplier/check-email', [SupplierRegistrationController::class, 'checkEmail'])
    ->middleware('throttle:30,1');

// Inscription porteur de projet (SCRUM-23).
Route::post('/auth/register/buyer', [BuyerRegistrationController::class, 'store'])
    ->middleware('throttle:register');

// Lien reçu par e-mail : pas besoin d'être connecté, la signature du lien suffit (SCRUM-24).
Route::get('/auth/email/verify/{id}/{hash}', [EmailVerificationController::class, 'verify'])
    ->whereNumber('id')
    ->middleware('throttle:6,1')
    ->name('verification.verify');

// Données de référence des formulaires.
Route::get('/reference/regions', [ReferenceController::class, 'regions']);
Route::get('/reference/categories', [ReferenceController::class, 'categories']);
Route::get('/reference/sectors', [ReferenceController::class, 'sectors']);

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

        // Profil de l'entreprise (SCRUM-28) : toujours le profil de l'utilisateur connecté.
        Route::get('/profile', [SupplierProfileController::class, 'show']);
        Route::put('/profile', [SupplierProfileController::class, 'update']);
        Route::post('/profile/logo', [SupplierProfileController::class, 'updateLogo']);
        Route::patch('/profile/publish', [SupplierProfileController::class, 'publish']);
        Route::post('/documents', [SupplierDocumentController::class, 'store']);
        Route::get('/documents/{document}/download', [SupplierDocumentController::class, 'download'])
            ->whereNumber('document');

        // État du dossier (SCRUM-27) : ouvert aussi à un fournisseur en attente ou refusé.
        Route::get('/validation-status', [SupplierValidationStatusController::class, 'show']);

        // Pages de vente : réservées aux fournisseurs validés par l'administrateur (SCRUM-27).
        // Ajoutez ici les routes produits (F07 / SCRUM-34…) et devis (F13 / SCRUM-46…).
        // Réponse sinon : 403 { "reason": "supplier_not_validated" }.
        // Restent hors de ce groupe : profil, documents, état du dossier, déconnexion, notifications.
        Route::middleware('supplier.validated')->group(function () {
            //
        });
    });

    // Espace porteur de projet (S3+) : demandes, comparaison des devis, commandes…
    Route::middleware('role:buyer')->prefix('buyer')->group(function () {
        Route::get('/ping', fn () => ['space' => 'buyer']);
    });

    // Back-office (S1+) : validation des fournisseurs, catégories, litiges…
    Route::middleware('role:admin')->prefix('admin')->group(function () {
        Route::get('/ping', fn () => ['space' => 'admin']);

        // Validation ou refus des nouveaux fournisseurs (SCRUM-31).
        Route::get('/suppliers', [SupplierValidationController::class, 'index']);
        Route::get('/suppliers/{supplier}', [SupplierValidationController::class, 'show'])
            ->whereNumber('supplier');
        Route::get('/suppliers/documents/{document}/download', [SupplierValidationController::class, 'downloadDocument'])
            ->whereNumber('document');
        Route::post('/suppliers/{supplier}/approve', [SupplierValidationController::class, 'approve'])
            ->whereNumber('supplier');
        Route::post('/suppliers/{supplier}/reject', [SupplierValidationController::class, 'reject'])
            ->whereNumber('supplier');
    });
});