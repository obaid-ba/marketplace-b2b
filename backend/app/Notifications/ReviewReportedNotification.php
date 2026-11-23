<?php

namespace App\Notifications;

use App\Models\ReviewReport;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

/**
 * Un fournisseur a signalé un avis : prévient les administrateurs (SCRUM-66). Traitement : F29 / SCRUM-74.
 */
class ReviewReportedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public ReviewReport $report)
    {
        $this->afterCommit();
    }

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $this->report->loadMissing('review.supplier');

        return [
            'event' => 'review_reported',
            'title' => 'Avis signalé',
            'message' => $this->report->review->supplier?->company_name.' — '.(ReviewReport::REASONS[$this->report->reason] ?? $this->report->reason),
            'review_id' => $this->report->review_id,
            'report_id' => $this->report->id,
            'url' => null,
        ];
    }
}
