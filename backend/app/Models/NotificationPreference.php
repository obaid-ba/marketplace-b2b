<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Préférences de notification : un choix par événement et par canal (SCRUM-63).
 * Les e-mails critiques (commande validée, compte validé/refusé, litige) ne peuvent
 * pas être désactivés : la règle est appliquée ici, jamais uniquement dans l'interface.
 */
class NotificationPreference extends Model
{
    public const CHANNEL_SITE = 'site';

    public const CHANNEL_EMAIL = 'email';

    public const EVENT_TENDER_RECEIVED = 'tender_received';

    public const EVENT_TENDER_CANCELLED = 'tender_cancelled';

    public const EVENT_QUOTE_RECEIVED = 'quote_received';

    public const EVENT_QUOTE_ACCEPTED = 'quote_accepted';

    public const EVENT_QUOTE_REJECTED = 'quote_rejected';

    public const EVENT_ORDER_VALIDATED = 'order_validated';

    public const EVENT_ORDER_STATUS = 'order_status_changed';

    public const EVENT_ACCOUNT_VALIDATED = 'account_validated';

    public const EVENT_ACCOUNT_REJECTED = 'account_rejected';

    public const EVENT_ANNOUNCEMENT_REMOVED = 'announcement_removed';

    public const EVENT_DISPUTE_DECISION = 'dispute_decision';

    public const EVENT_MESSAGE_RECEIVED = 'message_received';

    /**
     * Événements proposés dans la grille des préférences.
     *
     * @var array<string, string>
     */
    public const EVENTS = [
        self::EVENT_TENDER_RECEIVED => 'Nouvelle demande reçue',
        self::EVENT_TENDER_CANCELLED => 'Demande annulée',
        self::EVENT_QUOTE_RECEIVED => 'Nouveau devis reçu',
        self::EVENT_QUOTE_ACCEPTED => 'Devis accepté',
        self::EVENT_QUOTE_REJECTED => 'Devis refusé',
        self::EVENT_ORDER_VALIDATED => 'Commande validée',
        self::EVENT_ORDER_STATUS => "Changement d'étape d'une commande",
        self::EVENT_MESSAGE_RECEIVED => 'Nouveau message',
        self::EVENT_ACCOUNT_VALIDATED => 'Compte validé',
        self::EVENT_ACCOUNT_REJECTED => 'Compte refusé',
        self::EVENT_ANNOUNCEMENT_REMOVED => 'Annonce retirée',
        self::EVENT_DISPUTE_DECISION => 'Décision de litige',
    ];

    /**
     * E-mails considérés comme critiques : toujours envoyés, quel que soit le réglage.
     *
     * @var list<string>
     */
    public const CRITICAL_EMAIL_EVENTS = [
        self::EVENT_ORDER_VALIDATED,
        self::EVENT_ACCOUNT_VALIDATED,
        self::EVENT_ACCOUNT_REJECTED,
        self::EVENT_DISPUTE_DECISION,
    ];

    /**
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'event_type',
        'channel',
        'enabled',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public static function isCriticalEmail(string $event): bool
    {
        return in_array($event, self::CRITICAL_EMAIL_EVENTS, true);
    }

    /**
     * Un événement est autorisé par défaut : l'utilisateur ne reçoit une notification
     * que s'il ne l'a pas explicitement désactivée. Les e-mails critiques restent actifs.
     */
    public static function allows(User $user, string $event, string $channel): bool
    {
        if ($channel === self::CHANNEL_EMAIL && self::isCriticalEmail($event)) {
            return true;
        }

        $preference = static::query()
            ->where('user_id', $user->id)
            ->where('event_type', $event)
            ->where('channel', $channel)
            ->first();

        return $preference?->enabled ?? true;
    }

    /**
     * Grille complète (événement × canal) utilisée par la page de préférences.
     *
     * @return list<array<string, mixed>>
     */
    public static function gridFor(User $user): array
    {
        $saved = static::query()->where('user_id', $user->id)->get()->keyBy(
            fn (self $preference) => $preference->event_type.'|'.$preference->channel
        );

        $rows = [];

        foreach (self::EVENTS as $event => $label) {
            $site = $saved->get($event.'|'.self::CHANNEL_SITE)?->enabled ?? true;
            $email = $saved->get($event.'|'.self::CHANNEL_EMAIL)?->enabled ?? true;
            $critical = self::isCriticalEmail($event);

            $rows[] = [
                'event_type' => $event,
                'label' => $label,
                'critical_email' => $critical,
                'channels' => [
                    self::CHANNEL_SITE => [
                        'enabled' => (bool) $site,
                        'locked' => false,
                    ],
                    self::CHANNEL_EMAIL => [
                        'enabled' => $critical ? true : (bool) $email,
                        'locked' => $critical,
                    ],
                ],
            ];
        }

        return $rows;
    }
}
