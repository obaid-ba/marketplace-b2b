<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Message d'une conversation, avec une pièce jointe facultative (SCRUM-60).
 */
class Message extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'conversation_id',
        'sender_id',
        'body',
        'attachment_path',
        'attachment_name',
        'attachment_mime',
        'attachment_size',
        'sent_at',
    ];

    /**
     * Le chemin du fichier reste privé : le téléchargement passe par l'API.
     *
     * @var list<string>
     */
    protected $hidden = ['attachment_path'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'sent_at' => 'datetime',
            'attachment_size' => 'integer',
        ];
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id')->withTrashed();
    }

    /**
     * Messages reçus par l'utilisateur et pas encore lus. La comparaison porte sur l'identifiant
     * du message, pas sur la date : deux messages envoyés dans la même seconde restent distincts.
     *
     * @param  Builder<Message>  $query
     */
    public function scopeUnreadBy(Builder $query, User $user): void
    {
        $query->where('messages.sender_id', '!=', $user->id)
            ->whereExists(fn ($participant) => $participant->selectRaw('1')
                ->from('conversation_participants as cp')
                ->whereColumn('cp.conversation_id', 'messages.conversation_id')
                ->where('cp.user_id', $user->id)
                ->whereRaw('messages.id > coalesce(cp.last_read_message_id, 0)'));
    }
}
