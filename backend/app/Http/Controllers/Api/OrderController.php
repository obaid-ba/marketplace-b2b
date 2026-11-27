<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Models\Order;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Consultation détaillée d'une commande et de ses pièces jointes (SCRUM-51, SCRUM-58 / F16).
 */
class OrderController extends Controller
{
    /**
     * Détail complet d'une commande (accès cloisonné : acheteur propriétaire, fournisseur destinataire ou admin).
     */
    public function show(Request $request, Order $order): JsonResponse
    {
        $this->authorizeOrderAccess($request, $order);

        $order->load([
            'buyer.user:id,name,email,phone',
            'buyer:id,user_id,organization,sector,city,address',
            'supplier.user:id,name,email,phone',
            'supplier:id,user_id,company_name,logo,region_id,city,address,delivery_days,payment_terms',
            'items.product',
            'statusHistory.changer:id,name',
            'documents',
            'review',
        ]);

        return response()->json([
            'order' => $order,
        ]);
    }

    /**
     * Téléchargement sécurisé d'un document commercial (devis, facture).
     */
    public function downloadDocument(Request $request, Order $order, Document $document): StreamedResponse|JsonResponse
    {
        $this->authorizeOrderAccess($request, $order);

        if ($document->order_id !== $order->id) {
            return response()->json(['message' => 'Document introuvable pour cette commande.'], 404);
        }

        /** @var \Illuminate\Filesystem\FilesystemAdapter $storage */
        $storage = Storage::disk('local');

        if ($document->pdf_path && $storage->exists($document->pdf_path)) {
            $filename = "{$document->type}_{$document->number}.pdf";
            return $storage->response($document->pdf_path, $filename);
        }

        return response()->json(['message' => 'Le fichier PDF du document n\'est pas encore disponible.'], 404);
    }

    /**
     * Vérifie que l'utilisateur est soit l'acheteur, soit le fournisseur de la commande, soit admin.
     */
    protected function authorizeOrderAccess(Request $request, Order $order): void
    {
        $user = $request->user();

        if ($user->hasRole(UserRole::Admin)) {
            return;
        }

        if ($order->buyer && $order->buyer->user_id === $user->id) {
            return;
        }

        if ($order->supplier && $order->supplier->user_id === $user->id) {
            return;
        }

        abort(403, 'Accès non autorisé à cette commande.');
    }
}
