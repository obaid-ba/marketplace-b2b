<?php

namespace App\Http\Middleware;

use App\Enums\UserRole;
use App\Enums\ValidationStatus;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Ferme les pages de vente (produits, devis…) tant que l'administrateur n'a pas validé
 * le dossier du fournisseur (SCRUM-27). Le champ "reason" permet au front de renvoyer
 * l'utilisateur sur « Compte en attente de validation ».
 *
 * Usage : ->middleware('supplier.validated'), après 'role:supplier'.
 * Les autres rôles ne sont pas concernés (le middleware "role" s'en charge).
 */
class EnsureSupplierIsValidated
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user?->role === UserRole::Supplier
            && $user->supplierProfile?->validation_status !== ValidationStatus::VALIDATED) {
            return response()->json([
                'message' => "Votre compte fournisseur doit être validé par un administrateur avant d'accéder à cette page.",
                'reason' => 'supplier_not_validated',
            ], 403);
        }

        return $next($request);
    }
}
