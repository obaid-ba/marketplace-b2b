<?php

namespace App\Http\Controllers\Api\Supplier;

use App\Http\Controllers\Controller;
use App\Models\Dispute;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Litiges reçus par un fournisseur (SCRUM-67 / F21).
 * Lecture seule : la décision appartient à l'administration.
 */
class SupplierDisputeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $supplier = $request->user()->supplierProfile;

        if (! $supplier) {
            return response()->json(['message' => 'Profil fournisseur introuvable.'], 403);
        }

        $disputes = Dispute::query()
            ->whereHas('order', fn ($query) => $query->where('supplier_id', $supplier->id))
            ->with([
                'order:id,buyer_id,total,status,created_at',
                'order.buyer.user:id,name,email',
                'attachments',
                'assignedAdmin:id,name',
            ])
            ->latest('id')
            ->paginate(max(1, min(50, (int) $request->query('per_page', 15))));

        return response()->json($disputes);
    }
}
