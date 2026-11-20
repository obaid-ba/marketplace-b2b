<?php

namespace App\Jobs;

use App\Enums\UserStatus;
use App\Enums\ValidationStatus;
use App\Models\NotificationPreference;
use App\Models\SupplierProfile;
use App\Models\Tender;
use App\Models\TenderRecipient;
use App\Notifications\TenderReceivedNotification;
use App\Services\RelevanceScorer;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Diffusion automatique d'une demande aux fournisseurs validés dont la catégorie
 * et la région correspondent (SCRUM-42 / F12). Le score de pertinence est calculé
 * à la volée et conservé sur chaque destinataire.
 */
class DiffuseTenderJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(public int $tenderId) {}

    public function handle(RelevanceScorer $scorer): void
    {
        $tender = Tender::query()->with(['category:id,name', 'region:id,name'])->find($this->tenderId);

        if (! $tender || ! $tender->isOpen()) {
            return;
        }

        $suppliers = SupplierProfile::query()
            ->where('validation_status', ValidationStatus::VALIDATED->value)
            ->whereHas('user', fn ($query) => $query->where('status', UserStatus::ACTIVE->value))
            ->whereHas('categories', fn ($query) => $query->where('categories.id', $tender->category_id))
            ->when($tender->region_id, function ($query) use ($tender) {
                $query->where(function ($scope) use ($tender) {
                    $scope->where('region_id', $tender->region_id)
                        ->orWhereHas('coverageRegions', fn ($region) => $region->where('regions.id', $tender->region_id));
                });
            })
            ->with(['user', 'categories:id,name', 'coverageRegions:id', 'region:id'])
            ->get();

        foreach ($suppliers as $supplier) {
            $recipient = TenderRecipient::query()->firstOrNew([
                'tender_id' => $tender->id,
                'supplier_id' => $supplier->id,
            ]);

            $alreadyNotified = $recipient->exists && $recipient->notified_at !== null;

            if (! $recipient->exists) {
                $recipient->source = TenderRecipient::SOURCE_AUTOMATIC;
                $recipient->score = $scorer->score($tender, $supplier);
            } elseif ($recipient->score === null) {
                $recipient->score = $scorer->score($tender, $supplier);
            }

            if (! $alreadyNotified) {
                $recipient->notified_at = now();
            }

            $recipient->save();

            if ($alreadyNotified) {
                continue;
            }

            if ($supplier->user) {
                try {
                    $supplier->user->notify(new TenderReceivedNotification($tender, (float) $recipient->score));
                } catch (\Throwable $exception) {
                    // Un e-mail en panne ne doit pas annuler la diffusion déjà enregistrée.
                    Log::warning('Notification de demande non envoyée', [
                        'tender_id' => $tender->id,
                        'supplier_id' => $supplier->id,
                        'error' => $exception->getMessage(),
                    ]);
                }
            }
        }
    }
}
