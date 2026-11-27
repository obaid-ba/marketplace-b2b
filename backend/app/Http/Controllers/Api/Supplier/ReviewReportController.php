<?php

namespace App\Http\Controllers\Api\Supplier;

use App\Enums\ReviewStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\Review;
use App\Models\ReviewReport;
use App\Models\User;
use App\Notifications\ReviewReportedNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\Rule;

/**
 * Signaler un avis abusif (SCRUM-66). L'avis passe « signalé », mais reste visible et compté dans la note jusqu'à la décision
 * de l'administrateur : un signalement ne doit pas permettre de masquer une mauvaise note.
 */
class ReviewReportController extends Controller
{
    public function store(Request $request, Review $review): JsonResponse
    {
        if ($request->user()->supplierProfile?->id !== $review->supplier_id) {
            return response()->json(['message' => 'Action non autorisée sur cet avis.'], 403);
        }

        $validated = $request->validate([
            'reason' => ['required', Rule::in(array_keys(ReviewReport::REASONS))],
            'details' => ['nullable', 'required_if:reason,autre', 'string', 'max:1000'],
        ], [
            'reason.required' => 'Choisissez un motif.',
            'reason.in' => "Ce motif n'est pas valide.",
            'details.required_if' => 'Précisez le motif du signalement.',
            'details.max' => 'Les précisions ne doivent pas dépasser 1000 caractères.',
        ]);

        $report = DB::transaction(function () use ($request, $review, $validated) {
            $locked = Review::query()->lockForUpdate()->findOrFail($review->id);

            abort_if($locked->status === ReviewStatus::HIDDEN, 422, "Cet avis n'est plus visible.");

            $report = ReviewReport::query()->firstOrCreate(
                ['review_id' => $locked->id, 'author_id' => $request->user()->id],
                [...$validated, 'status' => ReviewReport::STATUS_PENDING],
            );

            if ($report->wasRecentlyCreated) {
                $locked->update(['status' => ReviewStatus::REPORTED]);
            }

            return $report;
        });

        if (! $report->wasRecentlyCreated) {
            return response()->json(['message' => 'Vous avez déjà signalé cet avis.'], 422);
        }

        Notification::send(User::query()->where('role', UserRole::Admin)->get(), new ReviewReportedNotification($report));

        return response()->json([
            'message' => "Avis signalé. L'administrateur va l'examiner ; l'avis reste visible jusqu'à sa décision.",
            'report' => $report->only(['id', 'reason', 'status']),
        ], 201);
    }
}
