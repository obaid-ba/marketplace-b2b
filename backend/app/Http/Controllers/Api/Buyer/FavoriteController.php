<?php

namespace App\Http\Controllers\Api\Buyer;

use App\Http\Controllers\Controller;
use App\Http\Resources\TenderFavoriteSupplierResource;
use App\Models\Quote;
use App\Models\SupplierProfile;
use App\Models\Tender;
use App\Models\TenderRecipient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

/**
 * Fournisseurs favoris du porteur, utilisés pour l'invitation sur une demande (SCRUM-49).
 */
class FavoriteController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $buyer = $request->user()->buyerProfile()->firstOrFail();

        $suppliers = $buyer->favorites()
            ->with(['supplier.region:id,name', 'supplier.categories:id,name'])
            ->latest()
            ->get()
            ->pluck('supplier')
            ->filter();

        $tenderId = $request->integer('tender_id');

        if ($tenderId) {
            $invited = TenderRecipient::query()->where('tender_id', $tenderId)->pluck('supplier_id')->all();
            $responded = Quote::query()->where('tender_id', $tenderId)->pluck('supplier_id')->all();

            foreach ($suppliers as $supplier) {
                $supplier->setAttribute('invited', in_array($supplier->id, $invited, true));
                $supplier->setAttribute('responded', in_array($supplier->id, $responded, true));
            }
        }

        return TenderFavoriteSupplierResource::collection($suppliers);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'supplier_id' => ['required', 'integer', 'exists:supplier_profiles,id'],
        ]);

        $buyer = $request->user()->buyerProfile()->firstOrFail();
        $supplier = SupplierProfile::query()->findOrFail($data['supplier_id']);

        $buyer->favorites()->firstOrCreate(['supplier_id' => $supplier->id]);

        return response()->json([
            'message' => 'Fournisseur ajouté à vos favoris.',
            'supplier_id' => $supplier->id,
        ], 201);
    }

    public function destroy(Request $request, int $supplier): JsonResponse
    {
        $request->validate([
            'supplier' => [Rule::exists('supplier_profiles', 'id')],
        ]);

        $buyer = $request->user()->buyerProfile()->firstOrFail();
        $buyer->favorites()->where('supplier_id', $supplier)->delete();

        return response()->json(['message' => 'Fournisseur retiré de vos favoris.']);
    }
}
