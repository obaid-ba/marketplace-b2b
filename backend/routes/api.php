<?php

use App\Http\Controllers\Api\AccountController;
use App\Http\Controllers\Api\Admin\AdminDashboardController;
use App\Http\Controllers\Api\Admin\CategoryController as AdminCategoryController;
use App\Http\Controllers\Api\Admin\SupplierValidationController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\Buyer\FavoriteController;
use App\Http\Controllers\Api\Buyer\FavoriteSupplierController;
use App\Http\Controllers\Api\Buyer\BuyerOrderController;
use App\Http\Controllers\Api\Buyer\BuyerReviewController;
use App\Http\Controllers\Api\Buyer\OrderController as BuyerOrderLifecycleController;
use App\Http\Controllers\Api\Buyer\QuoteController as BuyerQuoteController;
use App\Http\Controllers\Api\Buyer\TenderController as BuyerTenderController;
use App\Http\Controllers\Api\BuyerRegistrationController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\DocumentController;
use App\Http\Controllers\Api\EmailVerificationController;
use App\Http\Controllers\Api\HomeController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\NotificationPreferenceController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\PasswordResetController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\ReferenceController;
use App\Http\Controllers\Api\Supplier\SupplierDocumentController;
use App\Http\Controllers\Api\Supplier\SupplierOrderController;
use App\Http\Controllers\Api\Supplier\SupplierProfileController;
use App\Http\Controllers\Api\Supplier\SupplierProductController;
use App\Http\Controllers\Api\Supplier\SupplierReviewController;
use App\Http\Controllers\Api\Supplier\SupplierValidationStatusController;
use App\Http\Controllers\Api\Supplier\TenderController as SupplierTenderController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\SupplierPublicReviewController;
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

// Vitrine publique (S2) : catégories, accueil et catalogue.
Route::get('/categories', [CategoryController::class, 'index']);
Route::get('/home', HomeController::class);
Route::get('/products', [ProductController::class, 'index'])->middleware('throttle:120,1');
Route::get('/products/{product}', [ProductController::class, 'show'])->whereNumber('product')->middleware('throttle:120,1');
Route::get('/suppliers/{supplier}/products', [ProductController::class, 'bySupplier'])->whereNumber('supplier');
Route::get('/suppliers/{supplier}', [SupplierController::class, 'show'])->whereNumber('supplier');
Route::get('/suppliers/{supplier}/reviews', [SupplierController::class, 'reviews'])->whereNumber('supplier');
Route::get('/suppliers/{supplier}/public-reviews', [SupplierPublicReviewController::class, 'index'])->whereNumber('supplier');

Route::middleware('auth:sanctum')->group(function () {
    // Accessibles même si l'e-mail n'est pas encore vérifié.
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::post('/auth/email/resend', [EmailVerificationController::class, 'resend'])
        ->middleware('throttle:verification-resend');

    // Paramètres du compte (SCRUM-98) : informations (nom, téléphone, profil, e-mail),
    // mot de passe, désactivation et suppression. La suppression est douce (historique conservé).
    Route::get('/account', [AccountController::class, 'show']);
    Route::put('/account', [AccountController::class, 'updateAccount']);
    Route::patch('/account/profile', [AccountController::class, 'updateProfile']);
    Route::put('/account/password', [AccountController::class, 'updatePassword'])
        ->middleware('throttle:6,1');
    Route::patch('/account/email', [AccountController::class, 'updateEmail'])
        ->middleware('throttle:6,1');
    Route::post('/account/deactivate', [AccountController::class, 'deactivate'])
        ->middleware('throttle:6,1');
    Route::delete('/account', [AccountController::class, 'destroy'])
        ->middleware('throttle:6,1');

    // Notifications (F15 / SCRUM-62, SCRUM-63). Les identifiants sont des UUID (table native de Laravel).
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::get('/notifications/preferences', [NotificationPreferenceController::class, 'show']);
    Route::put('/notifications/preferences', [NotificationPreferenceController::class, 'update']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/{notification}/read', [NotificationController::class, 'markRead'])
        ->whereUuid('notification');
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

        // Commandes reçues par le fournisseur (SCRUM-58 / F16).
        Route::get('/orders', [SupplierOrderController::class, 'index']);
        Route::post('/orders/{order}/advance', [SupplierOrderController::class, 'advance'])
            ->whereNumber('order');

        // Avis reçus par le fournisseur (SCRUM-65 / F20).
        Route::get('/reviews', [SupplierReviewController::class, 'index']);
        Route::post('/reviews/{review}/reply', [SupplierReviewController::class, 'reply'])
            ->whereNumber('review');

        // Pages de vente : réservées aux fournisseurs validés par l'administrateur (SCRUM-27).
        // Ajoutez ici les routes produits (F07 / SCRUM-34…) et devis (F13 / SCRUM-46…).
        // Réponse sinon : 403 { "reason": "supplier_not_validated" }.
        // Restent hors de ce groupe : profil, documents, état du dossier, déconnexion, notifications.
        Route::middleware('supplier.validated')->group(function () {
            Route::get('/tenders', [SupplierTenderController::class, 'index']);
            Route::get('/tenders/{tender}', [SupplierTenderController::class, 'show'])->whereNumber('tender');
            Route::get('/tenders/{tender}/attachments/{attachment}', [SupplierTenderController::class, 'downloadAttachment'])
                ->whereNumber('tender')
                ->whereNumber('attachment');
            Route::post('/tenders/{tender}/quote', [SupplierTenderController::class, 'storeQuote'])->whereNumber('tender');
            Route::put('/tenders/{tender}/quote', [SupplierTenderController::class, 'updateQuote'])->whereNumber('tender');
            Route::get('/quotes', [SupplierTenderController::class, 'myQuotes']);

            Route::get('/products', [SupplierProductController::class, 'index']);
            Route::patch('/products/{product}/unpublish', [SupplierProductController::class, 'unpublish'])->whereNumber('product');
            Route::delete('/products/{product}', [SupplierProductController::class, 'destroy'])->whereNumber('product');
            Route::post('/products', [SupplierProductController::class, 'store']);
            Route::get('/products/{product}', [SupplierProductController::class, 'show'])->whereNumber('product');
            Route::put('/products/{product}', [SupplierProductController::class, 'update'])->whereNumber('product');
            Route::post('/products/{product}/images', [SupplierProductController::class, 'storeImages'])->whereNumber('product');
            Route::put('/products/{product}/images/order', [SupplierProductController::class, 'reorderImages'])->whereNumber('product');
            Route::delete('/products/{product}/images/{image}', [SupplierProductController::class, 'destroyImage'])
                ->whereNumber('product')
                ->whereNumber('image');
        });
    });

    // Espace porteur de projet (S3+) : demandes, comparaison des devis, commandes…
    Route::middleware('role:buyer')->prefix('buyer')->group(function () {
        Route::get('/ping', fn () => ['space' => 'buyer']);

        Route::get('/tenders', [BuyerTenderController::class, 'index']);
        Route::post('/tenders', [BuyerTenderController::class, 'store']);
        Route::get('/tenders/{tender}', [BuyerTenderController::class, 'show'])->whereNumber('tender');
        Route::get('/tenders/{tender}/attachments/{attachment}', [BuyerTenderController::class, 'downloadAttachment'])
            ->whereNumber('tender')
            ->whereNumber('attachment');
        Route::post('/tenders/{tender}/cancel', [BuyerTenderController::class, 'cancel'])->whereNumber('tender');
        Route::post('/tenders/{tender}/invite', [BuyerTenderController::class, 'invite'])->whereNumber('tender');

        Route::get('/tenders/{tender}/quotes', [BuyerQuoteController::class, 'index'])->whereNumber('tender');
        Route::post('/quotes/{quote}/accept', [BuyerQuoteController::class, 'accept'])->whereNumber('quote');

        Route::get('/favorites', [FavoriteController::class, 'index']);
        Route::post('/favorites/{supplier}', [FavoriteSupplierController::class, 'store'])->whereNumber('supplier');
        Route::delete('/favorites/{supplier}', [FavoriteSupplierController::class, 'destroy'])->whereNumber('supplier');

        // Commandes passées & commande directe (SCRUM-51, SCRUM-58 / F16).
        Route::get('/orders', [BuyerOrderController::class, 'index']);
        Route::post('/orders', [BuyerOrderController::class, 'store']);
        Route::get('/orders/{order}', [BuyerOrderLifecycleController::class, 'show'])->whereNumber('order');
        Route::post('/orders/{order}/confirm-receipt', [BuyerOrderController::class, 'confirmReceipt'])
            ->whereNumber('order');
        Route::post('/orders/{order}/review', [BuyerReviewController::class, 'store'])
            ->whereNumber('order');
    });

    // Suivi de commande et téléchargement de documents (SCRUM-58 / F16, SCRUM-57 / F19).
    Route::get('/orders/{order}', [OrderController::class, 'show'])
        ->whereNumber('order');
    Route::get('/orders/{order}/documents/{document}/download', [OrderController::class, 'downloadDocument'])
        ->whereNumber('order')
        ->whereNumber('document');
    Route::get('/documents/{document}/download', [DocumentController::class, 'download'])
        ->whereNumber('document');

    // Back-office (S1+) : validation des fournisseurs, catégories, litiges…
    Route::middleware('role:admin')->prefix('admin')->group(function () {
        Route::get('/ping', fn () => ['space' => 'admin']);
        Route::get('/dashboard', [AdminDashboardController::class, 'index']);

        Route::get('/categories', [AdminCategoryController::class, 'index']);
        Route::post('/categories', [AdminCategoryController::class, 'store']);
        Route::put('/categories/{category}', [AdminCategoryController::class, 'update'])->whereNumber('category');
        Route::patch('/categories/{category}/move', [AdminCategoryController::class, 'move'])->whereNumber('category');
        Route::delete('/categories/{category}', [AdminCategoryController::class, 'destroy'])->whereNumber('category');

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

        // Alias historique conservé pour les clients du back-office.
        Route::get('/supplier-applications', [SupplierValidationController::class, 'index']);
        Route::get('/supplier-applications/{supplier}', [SupplierValidationController::class, 'show'])
            ->whereNumber('supplier');
        Route::get('/supplier-applications/{supplier}/documents/{document}', [SupplierValidationController::class, 'showDocument'])
            ->whereNumber('supplier')
            ->whereNumber('document');
        Route::get('/supplier-applications/documents/{document}/download', [SupplierValidationController::class, 'downloadDocument'])
            ->whereNumber('document');
        Route::post('/supplier-applications/{supplier}/approve', [SupplierValidationController::class, 'approve'])
            ->whereNumber('supplier');
        Route::post('/supplier-applications/{supplier}/reject', [SupplierValidationController::class, 'reject'])
            ->whereNumber('supplier');
    });
});
