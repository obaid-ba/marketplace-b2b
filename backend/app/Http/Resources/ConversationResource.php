<?php

namespace App\Http\Resources;

use App\Enums\ConversationContext;
use App\Enums\UserRole;
use App\Models\Conversation;
use App\Models\Order;
use App\Models\Quote;
use App\Models\Tender;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;

/**
 * Conversation vue par l'utilisateur connecté : « party » est toujours l'autre personne.
 *
 * @mixin Conversation
 */
class ConversationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $user = $request->user();
        $iAmSupplier = $user->hasRole(UserRole::Supplier);

        return [
            'id' => $this->id,
            'party' => $iAmSupplier ? [
                'name' => $this->buyer->organization ?: $this->buyer->user?->name,
                'contact' => $this->buyer->user?->name,
                'avatar_url' => null,
                'supplier_id' => null,
            ] : [
                'name' => $this->supplier->company_name,
                'contact' => null,
                'avatar_url' => $this->supplier->logo ? Storage::disk('public')->url($this->supplier->logo) : null,
                'supplier_id' => $this->supplier->id,
            ],
            'context' => $this->contextFor($iAmSupplier),
            'unread_count' => (int) ($this->unread_count ?? 0),
            'other_last_read_message_id' => $this->whenLoaded(
                'participants',
                fn () => $this->participants->firstWhere('user_id', '!=', $user->id)?->last_read_message_id,
            ),
            'last_message' => $this->whenLoaded(
                'latestMessage',
                fn () => $this->latestMessage ? new MessageResource($this->latestMessage) : null,
            ),
            'last_message_at' => $this->last_message_at?->toIso8601String(),
        ];
    }

    /**
     * Charge en une requête par type les éléments liés aux conversations affichées.
     *
     * @param  Collection<int, Conversation>  $conversations
     */
    public static function loadContexts(Collection $conversations): void
    {
        $ids = fn (ConversationContext $type) => $conversations->where('context_type', $type)->pluck('context_id')->filter()->unique();

        $titles = [
            ConversationContext::TENDER->value => Tender::query()->whereIn('id', $ids(ConversationContext::TENDER))->pluck('title', 'id'),
            ConversationContext::QUOTE->value => Quote::query()->with('tender:id,title')->whereIn('id', $ids(ConversationContext::QUOTE))->get()
                ->mapWithKeys(fn (Quote $quote) => [$quote->id => ['title' => $quote->tender?->title, 'tender_id' => $quote->tender_id]]),
            ConversationContext::ORDER->value => Order::query()->whereIn('id', $ids(ConversationContext::ORDER))->pluck('id', 'id'),
        ];

        foreach ($conversations as $conversation) {
            $conversation->setAttribute('context_data', $titles[$conversation->context_type->value][$conversation->context_id] ?? null);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function contextFor(bool $iAmSupplier): array
    {
        $data = $this->context_data;

        [$label, $url] = match ($this->context_type) {
            ConversationContext::TENDER => [
                'Demande : '.($data ?? 'supprimée'),
                ($iAmSupplier ? '/fournisseur/demandes/' : '/porteur/demandes/').$this->context_id,
            ],
            ConversationContext::QUOTE => [
                'Devis : '.($data['title'] ?? 'supprimé'),
                $iAmSupplier ? '/fournisseur/devis' : '/porteur/demandes/'.($data['tender_id'] ?? '').'/devis',
            ],
            ConversationContext::ORDER => ["Commande n° {$this->context_id}", "/orders/{$this->context_id}"],
            ConversationContext::DIRECT => ['Contact direct', $iAmSupplier ? null : "/fournisseurs/{$this->supplier_id}"],
        };

        return [
            'type' => $this->context_type->value,
            'id' => $this->context_id,
            'label' => $label,
            'url' => $this->context_type !== ConversationContext::DIRECT && $data === null ? null : $url,
        ];
    }
}
