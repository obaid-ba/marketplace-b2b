<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\ReviewStatus;
use App\Http\Controllers\Controller;
use App\Jobs\AnalyzeReviewJob;
use App\Models\Review;
use App\Models\ReviewReport;
use App\Notifications\ReviewModeratedNotification;
use App\Services\AuditLogger;
use App\Services\SupplierRatingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Modération des avis signalés (SCRUM-74 / F29).
 *
 * L'administrateur conserve l'avis ou le masque. Masquer un avis recalcule
 * immédiatement la note du fournisseur ; chaque décision est auditée et
 * l'auteur de l'avis et le fournisseur sont notifiés.
 */
class AdminReviewController extends Controller
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly SupplierRatingService $ratings,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['nullable', 'string', 'in:'.implode(',', ReviewStatus::values())],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = Review::query()
            ->with([
                'buyer.user:id,name,first_name,last_name',
                'supplier:id,company_name',
                'order:id,created_at,total',
                'reports.author:id,name',
            ]);

        // File de modération : avis signalés en attente de décision.
        if (! empty($filters['status'])) {
            $query->where('status', $filters['status'])->latest('id');
        } else {
            $query->pendingModeration();
        }

        return response()->json($query->paginate((int) ($filters['per_page'] ?? 20)));
    }

    public function keep(Request $request, Review $review): JsonResponse
    {
        return $this->moderate($request, $review, ReviewStatus::PUBLISHED, 'conservé', null);
    }

    public function hide(Request $request, Review $review): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        return $this->moderate($request, $review, ReviewStatus::HIDDEN, 'masqué', $validated['reason'] ?? null);
    }

    private function moderate(
        Request $request,
        Review $review,
        ReviewStatus $status,
        string $decision,
        ?string $reason,
    ): JsonResponse {
        DB::transaction(function () use ($request, $review, $status, $decision, $reason) {
            $review->update(['status' => $status]);

            $review->reports()
                ->where('status', ReviewReport::STATUS_PENDING)
                ->update([
                    'status' => ReviewReport::STATUS_RESOLVED,
                    'admin_decision' => $decision.($reason ? " : {$reason}" : ''),
                ]);

            $this->ratings->recompute($review->supplier_id);

            $this->audit->record(
                $request->user(),
                $decision === 'masqué' ? 'review.hidden' : 'review.kept',
                "review:{$review->id}",
                $reason,
            );
        });

        // Le résumé « points forts / faibles » ne doit plus tenir compte d'un avis masqué (SCRUM-83).
        AnalyzeReviewJob::dispatch($review->supplier_id);

        $review->load(['buyer.user', 'supplier:id,company_name,user_id', 'supplier.user']);

        if ($review->buyer?->user) {
            $review->buyer->user->notify(new ReviewModeratedNotification($review, $decision, $reason));
        }
        $review->supplier?->user?->notify(new ReviewModeratedNotification($review, $decision, $reason));

        return response()->json([
            'message' => $decision === 'masqué'
                ? 'L\'avis a été masqué et la note du fournisseur recalculée.'
                : 'L\'avis a été conservé et reste publié.',
            'review' => $review->fresh(['reports', 'supplier:id,company_name,rating_avg,reviews_count']),
        ]);
    }
}
