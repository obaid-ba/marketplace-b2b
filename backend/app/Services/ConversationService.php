<?php

namespace App\Services;

use App\Enums\ConversationContext;
use App\Enums\UserRole;
use App\Enums\ValidationStatus;
use App\Events\ConversationRead;
use App\Events\MessageSent;
use App\Models\BuyerProfile;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Order;
use App\Models\Quote;
use App\Models\SupplierProfile;
use App\Models\Tender;
use App\Models\User;
use App\Notifications\NewMessageNotification;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * Règles de la messagerie (SCRUM-59 à SCRUM-61).
 *
 * Une conversation réunit toujours un porteur et un fournisseur. Il y en a une seule par couple et par contexte
 * (une demande, un devis, une commande, ou le contact direct) : « Contacter » rouvre la conversation existante.
 */
class ConversationService
{
    public const ATTACHMENT_DISK = 'local';

    /**
     * Ouvre (ou retrouve) la conversation liée à un contexte, après avoir vérifié que
     * l'utilisateur est bien l'une des deux parties concernées.
     */
    public function open(User $user, ConversationContext $context, ?int $contextId, ?int $supplierId): Conversation
    {
        [$buyer, $supplier] = match ($context) {
            ConversationContext::DIRECT => $this->directParties($user, $supplierId),
            ConversationContext::TENDER => $this->tenderParties($user, (int) $contextId, $supplierId),
            ConversationContext::QUOTE => $this->quoteParties($user, (int) $contextId),
            ConversationContext::ORDER => $this->orderParties($user, (int) $contextId),
        };

        $attributes = [
            'buyer_id' => $buyer->id,
            'supplier_id' => $supplier->id,
            'context_type' => $context->value,
            'context_id' => $context === ConversationContext::DIRECT ? null : $contextId,
        ];

        return DB::transaction(function () use ($attributes, $buyer, $supplier) {
            // Verrou sur le porteur : deux clics simultanés n'ouvrent pas deux conversations.
            BuyerProfile::query()->whereKey($buyer->id)->lockForUpdate()->first();

            $conversation = Conversation::query()->firstOrCreate($attributes);

            foreach ([$buyer->user_id, $supplier->user_id] as $userId) {
                $conversation->participants()->firstOrCreate(['user_id' => $userId]);
            }

            return $conversation;
        });
    }

    public function send(Conversation $conversation, User $sender, ?string $body, ?UploadedFile $attachment): Message
    {
        $path = $attachment?->store("conversations/{$conversation->id}", self::ATTACHMENT_DISK) ?: null;

        if ($attachment && ! $path) {
            throw ValidationException::withMessages(['attachment' => "La pièce jointe n'a pas pu être enregistrée."]);
        }

        try {
            $message = DB::transaction(function () use ($conversation, $sender, $body, $attachment, $path) {
                $message = $conversation->messages()->create([
                    'sender_id' => $sender->id,
                    'body' => trim((string) $body),
                    'attachment_path' => $path,
                    'attachment_name' => $attachment ? mb_substr($attachment->getClientOriginalName(), 0, 255) : null,
                    'attachment_mime' => $attachment?->getMimeType(),
                    'attachment_size' => $attachment?->getSize(),
                    'sent_at' => now(),
                ]);

                $conversation->update(['last_message_at' => $message->sent_at]);

                // L'expéditeur a forcément lu jusqu'à son propre message.
                $conversation->participants()->where('user_id', $sender->id)->update([
                    'last_read_at' => now(),
                    'last_read_message_id' => $message->id,
                ]);

                return $message;
            });
        } catch (\Throwable $e) {
            if ($path) {
                Storage::disk(self::ATTACHMENT_DISK)->delete($path);
            }

            throw $e;
        }

        $this->notifyRecipients($message, $sender);

        // Le temps réel est un confort : si Reverb est arrêté, le message est quand même envoyé.
        // event() et non broadcast() : ce dernier n'envoie qu'à sa destruction, donc hors de rescue().
        rescue(fn () => event(new MessageSent($message)));

        return $message;
    }

    /**
     * Marque la conversation comme lue jusqu'à son dernier message.
     */
    public function markRead(Conversation $conversation, User $user): void
    {
        $lastMessageId = $conversation->messages()->max('id');

        $updated = $conversation->participants()
            ->where('user_id', $user->id)
            ->whereRaw('coalesce(last_read_message_id, 0) < ?', [(int) $lastMessageId])
            ->update(['last_read_at' => now(), 'last_read_message_id' => $lastMessageId]);

        if (! $updated) {
            return;
        }

        $user->unreadNotifications()
            ->where('type', NewMessageNotification::class)
            ->where('data->conversation_id', $conversation->id)
            ->update(['read_at' => now()]);

        rescue(fn () => event(new ConversationRead($conversation, $user->id, (int) $lastMessageId)));
    }

    public function unreadTotal(User $user): int
    {
        return Message::query()->unreadBy($user)->count();
    }

    /**
     * Une seule notification tant que la conversation n'a pas été lue : dix messages d'affilée
     * ne doivent pas envoyer dix e-mails.
     */
    private function notifyRecipients(Message $message, User $sender): void
    {
        $recipients = User::query()
            ->whereIn('id', $message->conversation->participants()->where('user_id', '!=', $sender->id)->select('user_id'))
            ->get();

        foreach ($recipients as $recipient) {
            $unread = $message->conversation->messages()->unreadBy($recipient)->count();

            if ($unread === 1 && ! $recipient->isBlocked()) {
                $recipient->notify(new NewMessageNotification($message));
            }
        }
    }

    /**
     * @return array{0: BuyerProfile, 1: SupplierProfile}
     */
    private function directParties(User $user, ?int $supplierId): array
    {
        $buyer = $this->buyerOf($user) ?? throw new AuthorizationException('Seul un porteur de projet peut contacter directement un fournisseur.');

        $supplier = SupplierProfile::query()
            ->visibleInCatalog()
            ->where('validation_status', ValidationStatus::VALIDATED->value)
            ->find($supplierId);

        return [$buyer, $supplier ?? $this->unavailable('supplier_id', "Ce fournisseur n'est pas disponible.")];
    }

    /**
     * @return array{0: BuyerProfile, 1: SupplierProfile}
     */
    private function tenderParties(User $user, int $tenderId, ?int $supplierId): array
    {
        $tender = Tender::query()->with('buyer')->find($tenderId) ?? $this->unavailable('context_id', 'Demande introuvable.');

        // Le fournisseur parle toujours pour lui-même ; le porteur choisit l'un des destinataires de sa demande.
        if ($mySupplier = $this->supplierOf($user)) {
            $supplierId = $mySupplier->id;
        } elseif ($this->buyerOf($user)?->id !== $tender->buyer_id) {
            $this->deny();
        }

        $recipient = $tender->recipients()->where('supplier_id', $supplierId)->exists();

        if (! $recipient) {
            $mySupplier ? $this->deny() : $this->unavailable('supplier_id', "Ce fournisseur n'est pas destinataire de la demande.");
        }

        return [$tender->buyer, SupplierProfile::query()->findOrFail($supplierId)];
    }

    /**
     * @return array{0: BuyerProfile, 1: SupplierProfile}
     */
    private function quoteParties(User $user, int $quoteId): array
    {
        $quote = Quote::query()->with(['tender.buyer', 'supplier'])->find($quoteId) ?? $this->unavailable('context_id', 'Devis introuvable.');

        return $this->assertParty($user, $quote->tender->buyer, $quote->supplier);
    }

    /**
     * @return array{0: BuyerProfile, 1: SupplierProfile}
     */
    private function orderParties(User $user, int $orderId): array
    {
        $order = Order::query()->with(['buyer', 'supplier'])->find($orderId) ?? $this->unavailable('context_id', 'Commande introuvable.');

        return $this->assertParty($user, $order->buyer, $order->supplier);
    }

    /**
     * @return array{0: BuyerProfile, 1: SupplierProfile}
     */
    private function assertParty(User $user, BuyerProfile $buyer, SupplierProfile $supplier): array
    {
        if (! in_array($user->id, [$buyer->user_id, $supplier->user_id], true)) {
            $this->deny();
        }

        return [$buyer, $supplier];
    }

    private function buyerOf(User $user): ?BuyerProfile
    {
        return $user->hasRole(UserRole::Buyer) ? $user->buyerProfile : null;
    }

    private function supplierOf(User $user): ?SupplierProfile
    {
        return $user->hasRole(UserRole::Supplier) ? $user->supplierProfile : null;
    }

    private function deny(): never
    {
        throw new AuthorizationException("Vous n'êtes pas concerné par cet échange.");
    }

    private function unavailable(string $field, string $message): never
    {
        throw ValidationException::withMessages([$field => $message]);
    }
}
