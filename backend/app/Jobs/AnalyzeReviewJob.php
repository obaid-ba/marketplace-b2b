<?php

namespace App\Jobs;

use App\Exceptions\AiUnavailableException;
use App\Models\Review;
use App\Models\SupplierProfile;
use App\Services\ReviewInsightService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Après chaque nouvel avis (SCRUM-83, SCRUM-84) : sentiment et suspicion de l'avis, puis résumé du fournisseur.
 * Sans review_id (avis masqué par l'admin), seul le résumé est recalculé. L'IA indisponible n'empêche rien :
 * l'avis reste publié et sera analysé au prochain avis.
 */
class AnalyzeReviewJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    public function __construct(public int $supplierId, public ?int $reviewId = null) {}

    public function handle(ReviewInsightService $insights): void
    {
        try {
            if ($this->reviewId !== null && ($review = Review::query()->find($this->reviewId))) {
                $insights->analyzeReview($review);
            }

            if ($supplier = SupplierProfile::query()->with('user')->find($this->supplierId)) {
                $insights->summarizeSupplier($supplier);
            }
        } catch (AiUnavailableException) {
            // Déjà journalisé par AiService ; rien à annuler.
        }
    }
}
