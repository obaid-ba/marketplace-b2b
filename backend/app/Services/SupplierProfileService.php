<?php

namespace App\Services;

use App\Enums\ValidationStatus;
use App\Models\SupplierDocument;
use App\Models\SupplierProfile;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Règles métier du profil de l'entreprise (SCRUM-28).
 */
class SupplierProfileService
{
    /** Logo : disque public (affiché sur la fiche publique). */
    public const LOGO_DISK = 'public';

    /** Justificatifs : disque privé, téléchargés via une route autorisée. */
    public const DOCUMENT_DISK = 'local';

    public const MAX_DOCUMENTS = 20;

    /**
     * Relations chargées pour l'affichage du profil.
     */
    public function load(SupplierProfile $profile): SupplierProfile
    {
        return $profile->load([
            'region:id,name',
            'categories:id,parent_id,name',
            'coverageRegions:id,name',
            'documents' => fn ($query) => $query->latest('submitted_at')->latest('id'),
        ]);
    }

    /**
     * Champs texte + catégories proposées + zones couvertes. Les catégories et zones
     * couvertes servent ensuite à la diffusion des demandes aux fournisseurs (SCRUM-42).
     *
     * @param  array<string, mixed>  $data  données validées (UpdateSupplierProfileRequest)
     */
    public function update(SupplierProfile $profile, array $data): SupplierProfile
    {
        DB::transaction(function () use ($profile, $data) {
            // forceFill + liste explicite : aucun champ sensible ne peut passer par ici.
            $profile->forceFill([
                'company_name' => $data['company_name'],
                'description' => $data['description'] ?? null,
                'sector' => $data['sector'],
                'region_id' => $data['region_id'],
                'professional_phone' => $data['professional_phone'] ?? null,
                'professional_email' => $data['professional_email'] ?? null,
            ])->save();

            $profile->categories()->sync($data['categories']);
            $profile->coverageRegions()->sync($data['coverage_regions']);
        });

        return $this->load($profile->refresh());
    }

    public function updateLogo(SupplierProfile $profile, UploadedFile $file): SupplierProfile
    {
        $previous = $profile->logo;
        $path = $file->store('supplier-logos', self::LOGO_DISK);

        try {
            $profile->forceFill(['logo' => $path])->save();
        } catch (Throwable $exception) {
            Storage::disk(self::LOGO_DISK)->delete($path);

            throw $exception;
        }

        if ($previous) {
            Storage::disk(self::LOGO_DISK)->delete($previous);
        }

        return $this->load($profile);
    }

    public function addDocument(SupplierProfile $profile, string $type, UploadedFile $file): SupplierDocument
    {
        if ($profile->documents()->count() >= self::MAX_DOCUMENTS) {
            throw ValidationException::withMessages([
                'file' => 'Vous avez atteint le nombre maximum de documents ('.self::MAX_DOCUMENTS.').',
            ]);
        }

        $path = $file->store("supplier-documents/{$profile->id}", self::DOCUMENT_DISK);

        try {
            return DB::transaction(function () use ($profile, $type, $path) {
                // Un nouveau document est toujours « en attente » : seul l'admin le valide.
                $document = $profile->documents()->create([
                    'type' => $type,
                    'file_path' => $path,
                    'status' => ValidationStatus::PENDING,
                    'submitted_at' => now(),
                ]);

                $this->resubmitIfRejected($profile);

                return $document;
            });
        } catch (Throwable $exception) {
            Storage::disk(self::DOCUMENT_DISK)->delete($path);

            throw $exception;
        }
    }

    /**
     * Dossier refusé + nouveau justificatif envoyé : le dossier repasse « en attente » (SCRUM-27).
     * L'ancienne décision (motif, auteur, date) est effacée ; les anciens documents restent
     * dans l'historique avec leur statut. Un dossier en attente ou validé n'est pas modifié.
     */
    private function resubmitIfRejected(SupplierProfile $profile): void
    {
        if ($profile->validation_status !== ValidationStatus::REJECTED) {
            return;
        }

        $profile->forceFill([
            'validation_status' => ValidationStatus::PENDING,
            'rejection_reason' => null,
            'validated_by' => null,
            'validated_at' => null,
        ])->save();

        // TODO SCRUM-99 : prévenir les administrateurs qu'un dossier refusé a été renvoyé
        // (notification + entrée dans audit_logs une fois le modèle créé avec la validation admin).
    }

    /**
     * Un fournisseur non validé peut compléter son profil, mais pas le publier.
     */
    public function setPublished(SupplierProfile $profile, bool $published): SupplierProfile
    {
        if ($published && $profile->validation_status !== ValidationStatus::VALIDATED) {
            throw ValidationException::withMessages([
                'is_published' => 'Votre profil pourra être publié après la validation de votre compte par un administrateur.',
            ]);
        }

        $profile->forceFill(['is_published' => $published])->save();

        return $this->load($profile);
    }
}
