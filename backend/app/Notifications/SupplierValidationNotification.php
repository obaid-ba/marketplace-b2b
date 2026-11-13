<?php

namespace App\Notifications;

use App\Enums\ValidationStatus;
use App\Models\SupplierProfile;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class SupplierValidationNotification extends Notification
{
    use Queueable;

    public function __construct(
        public SupplierProfile $supplier,
        public ValidationStatus $status,
        public ?string $reason = null
    ) {}

    /**
     * Canaux de notification : e-mail + base de données (table notifications).
     *
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    /**
     * Contenu de l'e-mail envoyé au fournisseur.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $isApproved = $this->status === ValidationStatus::VALIDATED;

        $mail = (new MailMessage)
            ->subject($isApproved
                ? 'Votre dossier fournisseur a été validé'
                : 'Votre dossier fournisseur a été refusé')
            ->greeting("Bonjour {$notifiable->name},");

        if ($isApproved) {
            $mail->line("Félicitations ! Le dossier de votre entreprise « {$this->supplier->company_name} » a été validé par l'administrateur.")
                ->line('Vous avez désormais accès aux fonctionnalités de vente (catalogue produits et réponse aux appels d\'offres).');
        } else {
            $mail->line("Après examen, le dossier de votre entreprise « {$this->supplier->company_name} » a été refusé.")
                ->line("Motif du refus : {$this->reason}")
                ->line('Vous pouvez mettre à jour vos informations et vos documents justificatifs depuis votre espace fournisseur.');
        }

        return $mail->action(
            'Accéder à mon espace fournisseur',
            rtrim((string) config('app.frontend_url', env('FRONTEND_URL', 'http://localhost:5173')), '/')
        );
    }

    /**
     * Données stockées dans la table notifications (format JSON).
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $isApproved = $this->status === ValidationStatus::VALIDATED;

        return [
            'event_type' => $isApproved ? 'supplier.validated' : 'supplier.rejected',
            'supplier_id' => $this->supplier->id,
            'company_name' => $this->supplier->company_name,
            'validation_status' => $this->status->value,
            'reason' => $this->reason,
            'message' => $isApproved
                ? "Votre dossier fournisseur « {$this->supplier->company_name} » a été validé."
                : "Votre dossier fournisseur « {$this->supplier->company_name} » a été refusé. Motif : {$this->reason}",
        ];
    }
}