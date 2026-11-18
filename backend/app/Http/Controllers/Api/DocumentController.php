<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\Document;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Téléchargement des documents commerciaux PDF (SCRUM-57).
 */
class DocumentController extends Controller
{
    /**
     * Téléchargement sécurisé d'un document PDF (devis, facture).
     * Accessible à l'acheteur, au fournisseur concerné ou à un administrateur.
     */
    public function download(Request $request, Document $document): StreamedResponse|JsonResponse
    {
        $document->loadMissing(['order.buyer', 'order.supplier']);
        $order = $document->order;

        if (! $order) {
            return response()->json(['message' => 'Commande introuvable pour ce document.'], 404);
        }

        $user = $request->user();
        $isBuyer = $order->buyer && $order->buyer->user_id === $user->id;
        $isSupplier = $order->supplier && $order->supplier->user_id === $user->id;
        $isAdmin = $user->hasRole(UserRole::Admin);

        if (! $isBuyer && ! $isSupplier && ! $isAdmin) {
            return response()->json(['message' => 'Accès non autorisé à ce document.'], 403);
        }

        /** @var \Illuminate\Filesystem\FilesystemAdapter $storage */
        $storage = Storage::disk('local');

        if ($document->pdf_path && $storage->exists($document->pdf_path)) {
            $filename = "{$document->type}_{$document->number}.pdf";
            return $storage->response($document->pdf_path, $filename);
        }

        return response()->json(['message' => 'Le fichier PDF du document n\'est pas encore disponible.'], 404);
    }
}
