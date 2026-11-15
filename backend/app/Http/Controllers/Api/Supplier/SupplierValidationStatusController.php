<?php

namespace App\Http\Controllers\Api\Supplier;

use App\Http\Controllers\Controller;
use App\Http\Resources\SupplierValidationStatusResource;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * État du dossier du fournisseur connecté (SCRUM-27) : en attente, validé ou refusé avec le motif.
 * Toujours le profil de l'utilisateur connecté (aucun identifiant dans l'URL).
 */
class SupplierValidationStatusController extends Controller
{
    public function show(Request $request): SupplierValidationStatusResource
    {
        $profile = $request->user()->supplierProfile;
        abort_if($profile === null, 404, 'Profil fournisseur introuvable.');
        Gate::authorize('view', $profile);

        $profile->load([
            'user',
            'documents' => fn ($query) => $query->latest('submitted_at')->latest('id'),
        ]);

        return new SupplierValidationStatusResource($profile);
    }
}
