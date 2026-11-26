<?php

namespace App\Services;

use App\Enums\TenderStatus;
use App\Enums\ValidationStatus;
use App\Jobs\DiffuseTenderJob;
use App\Models\BuyerProfile;
use App\Models\SupplierProfile;
use App\Models\Tender;
use App\Models\TenderRecipient;
use App\Models\User;
use App\Notifications\TenderCancelledNotification;
use App\Notifications\TenderReceivedNotification;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * RÃ¨gles mÃ©tier des demandes cÃ´tÃ© porteur de projet (SCRUM-41, SCRUM-43, SCRUM-49).
 */
class TenderService
{
    public function __construct(
        private readonly RelevanceScorer $scorer,
        private readonly TenderAnalysisService $analysis,
    ) {}

    /**
     * Publie une demande et dÃ©clenche sa diffusion en file de tÃ¢ches.
     *
     * @param  array<string, mixed>  $data
     * @param  list<UploadedFile>  $attachments
     */
    public function publish(User $user, array $data, array $attachments = []): Tender
    {
        $buyer = $this->buyerProfile($user);

        $tender = DB::transaction(function () use ($buyer, $data, $attachments) {
            /** @var Tender $tender */
            $tender = $buyer->tenders()->create([
                'title' => $data['title'],
                'description' => $data['description'],
                'category_id' => $data['category_id'],
                'region_id' => $data['region_id'] ?? null,
                'budget' => $data['budget'] ?? null,
                'desired_deadline' => $data['desired_deadline'] ?? null,
                'status' => TenderStatus::OPEN,
            ]);

            foreach ($attachments as $file) {
                $tender->attachments()->create([
                    'file_path' => $file->store('tender-attachments', 'local'),
                    'original_name' => $file->getClientOriginalName(),
                ]);
            }

            return $tender;
        });

        // Catégorie et mots-clés détectés, fournisseurs suggérés retenus (SCRUM-81) : avant la diffusion,
        // pour que le score de pertinence tienne compte de l'analyse.
        $this->analysis->apply(
            $tender,
            $user,
            isset($data['ai_interaction_id']) ? (int) $data['ai_interaction_id'] : null,
            array_map('intval', $data['suggested_supplier_ids'] ?? []),
        );

        DiffuseTenderJob::dispatch($tender->id);

        return $this->loadForBuyer($tender);
    }

    /**
     * Annule une demande ouverte et prÃ©vient les fournisseurs qui avaient rÃ©pondu.
     */
    public function cancel(Tender $tender, User $user): Tender
    {
        $this->assertOwner($tender, $user);

        if (! $tender->isOpen()) {
            throw ValidationException::withMessages([
                'status' => 'Cette demande est dÃ©jÃ  clÃ´turÃ©e ou annulÃ©e.',
            ]);
        }

        $respondedSupplierIds = $tender->quotes()->pluck('supplier_id')->unique()->values();

        $tender->update(['status' => TenderStatus::CANCELLED]);

        $this->notifySuppliers($respondedSupplierIds->all(), new TenderCancelledNotification($tender));

        return $this->loadForBuyer($tender->refresh());
    }

    /**
     * Invite un fournisseur de confiance sur une demande ouverte (SCRUM-49).
     */
    public function invite(Tender $tender, SupplierProfile $supplier, User $user): TenderRecipient
    {
        $this->assertOwner($tender, $user);

        if (! $tender->isOpen()) {
            throw ValidationException::withMessages([
                'status' => 'Impossible dâ€™inviter un fournisseur sur une demande clÃ´turÃ©e ou annulÃ©e.',
            ]);
        }

        if ($supplier->validation_status !== ValidationStatus::VALIDATED) {
            throw ValidationException::withMessages([
                'supplier_id' => 'Ce fournisseur nâ€™est pas encore validÃ© par lâ€™administrateur.',
            ]);
        }

        /** @var TenderRecipient $recipient */
        $recipient = TenderRecipient::query()->firstOrNew([
            'tender_id' => $tender->id,
            'supplier_id' => $supplier->id,
        ]);

        $isNew = ! $recipient->exists;

        $recipient->source = $isNew ? TenderRecipient::SOURCE_INVITED : $recipient->source;
        $recipient->score ??= $this->scorer->score($tender, $supplier);

        if (! $recipient->notified_at) {
            $recipient->notified_at = now();
        }

        $recipient->save();

        if ($isNew && $supplier->user) {
            $supplier->user->notify(new TenderReceivedNotification(
                $tender,
                (float) $recipient->score,
                invited: true,
            ));
        }

        return $recipient->fresh(['supplier']);
    }

    public function loadForBuyer(Tender $tender): Tender
    {
        return $tender->load([
            'category:id,name',
            'region:id,name',
            'attachments:id,tender_id,file_path,original_name',
        ])->loadCount([
            'quotes',
            'recipients',
            'recipients as notified_count' => fn ($query) => $query->whereNotNull('notified_at'),
        ]);
    }

    private function buyerProfile(User $user): BuyerProfile
    {
        $buyer = $user->buyerProfile()->first();

        if (! $buyer) {
            abort(404, 'Profil porteur de projet introuvable.');
        }

        return $buyer;
    }

    private function assertOwner(Tender $tender, User $user): void
    {
        $buyer = $user->buyerProfile()->first();

        abort_if(! $buyer || $tender->buyer_id !== $buyer->id, 403, 'Cette demande ne vous appartient pas.');
    }

    /**
     * @param  list<int>  $supplierIds
     */
    private function notifySuppliers(array $supplierIds, object $notification): void
    {
        if ($supplierIds === []) {
            return;
        }

        SupplierProfile::query()
            ->with('user')
            ->whereIn('id', $supplierIds)
            ->get()
            ->pluck('user')
            ->filter()
            ->each(fn (User $supplierUser) => $supplierUser->notify($notification));
    }
}
