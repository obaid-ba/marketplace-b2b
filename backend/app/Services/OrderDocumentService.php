<?php

namespace App\Services;

use App\Models\Document;
use App\Models\Order;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/**
 * Service de génération et gestion des documents PDF de commande (SCRUM-57).
 */
class OrderDocumentService
{
    /**
     * Génère le numéro séquentiel unique pour un type de document.
     * Format : DEV-YYYY-00001 ou FAC-YYYY-00001
     */
    public function generateSequentialNumber(string $type, ?Carbon $date = null): string
    {
        $date = $date ?? Carbon::now();
        $prefix = $type === 'devis' ? 'DEV' : 'FAC';
        $year = $date->format('Y');
        $pattern = "{$prefix}-{$year}-";

        $lastDocument = Document::query()
            ->where('type', $type)
            ->where('number', 'like', "{$pattern}%")
            ->orderByDesc('id')
            ->first();

        $nextSeq = 1;
        if ($lastDocument && preg_match('/' . preg_quote($pattern, '/') . '(\d+)/', $lastDocument->number, $matches)) {
            $nextSeq = (int) $matches[1] + 1;
        }

        return sprintf('%s%05d', $pattern, $nextSeq);
    }

    /**
     * Génère le PDF d'un devis et crée l'enregistrement Document.
     */
    public function generateQuotePdf(Order $order): Document
    {
        return $this->generateDocument($order, 'devis', 'pdf.quote');
    }

    /**
     * Génère le PDF d'une facture et crée l'enregistrement Document.
     */
    public function generateInvoicePdf(Order $order): Document
    {
        return $this->generateDocument($order, 'facture', 'pdf.invoice');
    }

    /**
     * Génère et stocke un document PDF (devis ou facture).
     */
    protected function generateDocument(Order $order, string $type, string $viewName): Document
    {
        $order->loadMissing(['buyer.user', 'supplier.user', 'items', 'quote']);

        // Si le document existe déjà pour cette commande et ce type, on le réutilise si le fichier physique existe
        $existing = Document::where('order_id', $order->id)->where('type', $type)->first();
        if ($existing && Storage::disk('local')->exists($existing->pdf_path)) {
            return $existing;
        }

        $issuedAt = Carbon::now();
        $number = $existing?->number ?? $this->generateSequentialNumber($type, $issuedAt);

        $pdf = Pdf::loadView($viewName, [
            'order' => $order,
            'number' => $number,
            'issued_at' => $issuedAt,
        ]);

        $storagePath = "documents/orders/{$order->id}/{$number}.pdf";
        Storage::disk('local')->put($storagePath, $pdf->output());

        if ($existing) {
            $existing->update([
                'number' => $number,
                'pdf_path' => $storagePath,
                'issued_at' => $issuedAt,
            ]);
            return $existing;
        }

        return Document::create([
            'order_id' => $order->id,
            'type' => $type,
            'number' => $number,
            'pdf_path' => $storagePath,
            'issued_at' => $issuedAt,
        ]);
    }
}
