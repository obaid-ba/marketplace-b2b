<?php

namespace App\Models;

use App\Enums\ConversationContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * Conversation entre un porteur de projet et un fournisseur (SCRUM-59 à SCRUM-61).
 */
class Conversation extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = ['buyer_id', 'supplier_id', 'context_type', 'context_id', 'last_message_at'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'context_type' => ConversationContext::class,
            'last_message_at' => 'datetime',
        ];
    }

    public function buyer(): BelongsTo
    {
        return $this->belongsTo(BuyerProfile::class, 'buyer_id');
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(SupplierProfile::class, 'supplier_id');
    }

    public function participants(): HasMany
    {
        return $this->hasMany(ConversationParticipant::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(Message::class);
    }

    public function latestMessage(): HasOne
    {
        return $this->hasOne(Message::class)->latestOfMany();
    }

    /**
     * @param  Builder<Conversation>  $query
     */
    public function scopeForUser(Builder $query, User $user): void
    {
        $query->whereHas('participants', fn (Builder $participant) => $participant->where('user_id', $user->id));
    }

    /**
     * Ajoute unread_count : messages de l'autre partie envoyés après ma dernière lecture.
     *
     * @param  Builder<Conversation>  $query
     */
    public function scopeWithUnreadCountFor(Builder $query, User $user): void
    {
        $query->withCount(['messages as unread_count' => fn (Builder $message) => $message->unreadBy($user)]);
    }

    public function hasParticipant(User $user): bool
    {
        return $this->participants()->where('user_id', $user->id)->exists();
    }
}
