<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ReviewResource;
use App\Http\Resources\SupplierPublicResource;
use App\Models\Product;
use App\Models\Review;
use App\Models\SupplierProfile;
use App\Services\FavoriteService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Fiche publique d'un fournisseur (SCRUM-37) : accessible sans connexion.
 * 404 si le fournisseur n'est pas visible (non validé, suspendu, désactivé, supprimé ou profil non publié).
 */
class SupplierController extends Controller
{
    public const REVIEWS_PER_PAGE = 10;

    public function show(Request $request, int $supplier, FavoriteService $favorites): SupplierPublicResource
    {
        $profile = $this->visibleOrFail($supplier);
        $profile->load(['region:id,name', 'categories:id,name', 'coverageRegions:id,name']);

        $profile->visible_products_count = Product::query()->visible()->where('products.supplier_id', $profile->id)->count();
        $profile->is_favorite = $favorites->isFavorite($request->user('sanctum'), $profile);

        return new SupplierPublicResource($profile);
    }

    /**
     * Avis publiés, du plus récent au plus ancien, avec la réponse du fournisseur.
     */
    public function reviews(int $supplier): AnonymousResourceCollection
    {
        $profile = $this->visibleOrFail($supplier);

        $reviews = Review::query()
            ->published()
            ->where('supplier_id', $profile->id)
            ->with('buyer.user:id,name,first_name,last_name')
            ->latest()
            ->orderByDesc('id')
            ->paginate(self::REVIEWS_PER_PAGE);

        return ReviewResource::collection($reviews);
    }

    private function visibleOrFail(int $id): SupplierProfile
    {
        return SupplierProfile::query()->visibleInCatalog()->findOr($id, fn () => abort(404, 'Fournisseur introuvable.'));
    }
}
