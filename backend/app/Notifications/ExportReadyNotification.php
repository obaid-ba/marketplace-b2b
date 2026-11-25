<?php

namespace App\Notifications;

use App\Models\Export;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Notification envoyée à l'administrateur dès qu'un export est prêt (SCRUM-75).
 */
class ExportReadyNotification extends Notification
{
    use Queueable;

    public function __construct(public Export $export) {}

    /**
     * @return list<string>
     */
    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $from = $this->export->period_from?->toDateString();
        $to = $this->export->period_to?->toDateString();

        return (new MailMessage)
            ->subject("Votre export #{$this->export->id} est prêt")
            ->greeting("Bonjour {$notifiable->name},")
            ->line("L'export des statistiques du {$from} au {$to} est disponible au format ".strtoupper($this->export->format).'.')
            ->action('Télécharger l\'export', rtrim((string) config('app.frontend_url', env('FRONTEND_URL', 'http://localhost:5173')), '/').'/admin?exports=1')
            ->line('Le fichier reste disponible depuis le tableau de bord, « Exporter les statistiques ».');
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'title' => 'Export prêt',
            'url' => '/admin?exports=1',
            'event_type' => 'export.ready',
            'export_id' => $this->export->id,
            'format' => $this->export->format,
            'period_from' => $this->export->period_from?->toDateString(),
            'period_to' => $this->export->period_to?->toDateString(),
            'message' => "Votre export #{$this->export->id} est prêt.",
        ];
    }
}
