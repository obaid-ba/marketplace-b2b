<?php

namespace App\Http\Controllers\Api\Buyer;

use App\Http\Controllers\Controller;
use App\Http\Resources\FavoriteSupplierResource;
use App\Models\BuyerProfile;
use App\Models\SupplierProfile;
use App\Services\FavoriteService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Fournisseurs favoris du porteur de projet connecté (SCRUM-39).
 */
class FavoriteSupplierController extends Controller
{
    public function __construct(private readonly FavoriteService $favorites) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        return FavoriteSupplierResource::collection($this->favorites->list($this->buyer($request)));
    }

    /**
     * Ajouter (idempotent : un second appel ne crée pas de doublon). Seul un fournisseur visible peut être ajouté.
     */
    public function store(Request $request, SupplierProfile $supplier): JsonResponse
    {
        abort_unless(SupplierProfile::query()->visibleInCatalog()->whereKey($supplier->id)->exists(), 404, 'Fournisseur introuvable.');

        $this->favorites->add($this->buyer($request), $supplier);

        return response()->json([
            'message' => "« {$supplier->company_name} » a été ajouté à vos favoris.",
            'is_favorite' => true,
        ]);
    }

    /**
     * Retirer (idempotent), même si le fournisseur n'est plus visible.
     */
    public function destroy(Request $request, SupplierProfile $supplier): JsonResponse
    {
        $this->favorites->remove($this->buyer($request), $supplier);

        return response()->json([
            'message' => "« {$supplier->company_name} » a été retiré de vos favoris.",
            'is_favorite' => false,
        ]);
    }

    private function buyer(Request $request): BuyerProfile
    {
        $buyer = $request->user()->buyerProfile;
        abort_if($buyer === null, 403, 'Profil porteur de projet introuvable.');

        return $buyer;
    }
}
