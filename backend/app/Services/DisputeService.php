<?php

namespace App\Services;

use App\Enums\DisputeDecision;
use App\Enums\DisputeStatus;
use App\Enums\OrderStatus;
use App\Enums\UserRole;
use App\Enums\UserStatus;
use App\Models\AuditLog;
use App\Models\Dispute;
use App\Models\Order;
use App\Models\User;
use App\Notifications\DisputeDecidedNotification;
use App\Notifications\DisputeUpdatedNotification;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * Règles des litiges (SCRUM-117 / F23, règle métier R4).
 */
class DisputeService
{
    public const ATTACHMENT_DISK = 'local';

    /**
     * R4 : de l'expédition à la livraison. « en livraison » est l'autre nom de l'expédition (devis acceptés en S3).
     */
    private const OPENABLE_STATUSES = [OrderStatus::SHIPPED, OrderStatus::IN_DELIVERY, OrderStatus::DELIVERED];

    /**
     * Raison pour laquelle l'utilisateur ne peut pas ouvrir de litige, ou null s'il le peut.
     */
    public function refusalFor(User $user, Order $order): ?string
    {
        return match (true) {
            ! $this->isBuyer($user, $order) => "Seul l'acheteur peut signaler un problème sur sa commande.",
            $order->status === OrderStatus::CLOSED => 'Cette commande est clôturée : un litige ne peut plus être ouvert.',
            ! in_array($order->status, self::OPENABLE_STATUSES, true) => "Un problème peut être signalé dès l'expédition de la commande.",
            Dispute::query()->where('order_id', $order->id)->undecided()->exists() => 'Un litige est déjà en cours pour cette commande.',
            default => null,
        };
    }

    /**
     * @param  array{reason: string, description: string}  $data
     * @param  list<UploadedFile>  $files
     */
    public function open(User $user, Order $order, array $data, array $files): Dispute
    {
        if (! $this->isBuyer($user, $order)) {
            throw new AuthorizationException("Seul l'acheteur peut signaler un problème sur sa commande.");
        }

        $paths = [];

        try {
            $dispute = DB::transaction(function () use ($user, $order, $data, $files, &$paths) {
                // Verrou sur la commande : pas de double litige, ni de clôture pendant l'ouverture.
                $locked = Order::query()->lockForUpdate()->findOrFail($order->id);

                if ($refusal = $this->refusalFor($user, $locked)) {
                    throw ValidationException::withMessages(['order' => $refusal]);
                }

                $dispute = Dispute::create([
                    'order_id' => $locked->id,
                    'opened_by' => $user->id,
                    'reason' => $data['reason'],
                    'description' => $data['description'],
                    'status' => DisputeStatus::OPEN,
                ]);

                foreach ($files as $file) {
                    $path = $file->store("disputes/{$dispute->id}", self::ATTACHMENT_DISK);

                    if (! $path) {
                        throw ValidationException::withMessages(['attachments' => "Une pièce jointe n'a pas pu être enregistrée."]);
                    }

                    $paths[] = $path;
                    $dispute->attachments()->create([
                        'file_path' => $path,
                        'original_name' => mb_substr($file->getClientOriginalName(), 0, 255),
                        'mime' => $file->getMimeType(),
                        'size' => $file->getSize(),
                    ]);
                }

                return $dispute;
            });
        } catch (\Throwable $e) {
            Storage::disk(self::ATTACHMENT_DISK)->delete($paths);

            throw $e;
        }

        $this->supplierUser($dispute)?->notify(new DisputeUpdatedNotification($dispute, DisputeUpdatedNotification::OPENED));
        Notification::send($this->activeAdmins(), new DisputeUpdatedNotification($dispute, DisputeUpdatedNotification::OPENED));

        return $dispute;
    }

    /**
     * Un admin prend le litige en charge, ou le reprend à un collègue (tracé dans les deux cas).
     */
    public function take(Dispute $dispute, User $admin): Dispute
    {
        $wasOpen = DB::transaction(function () use ($dispute, $admin) {
            $locked = $this->lockUndecided($dispute);

            if ($locked->assigned_admin_id === $admin->id) {
                return false;
            }

            $wasOpen = $locked->status === DisputeStatus::OPEN;
            $previous = $locked->assigned_admin_id;

            $locked->update(['status' => DisputeStatus::IN_PROGRESS, 'assigned_admin_id' => $admin->id]);
            $this->audit($admin, $wasOpen ? 'dispute.taken' : 'dispute.reassigned', $locked, $previous ? "Repris à l'administrateur n° {$previous}" : null);

            return $wasOpen;
        });

        if ($wasOpen) {
            Notification::send($this->parties($dispute), new DisputeUpdatedNotification($dispute, DisputeUpdatedNotification::TAKEN));
        }

        return $dispute->refresh();
    }

    public function decide(Dispute $dispute, User $admin, DisputeDecision $decision, string $note): Dispute
    {
        DB::transaction(function () use ($dispute, $admin, $decision, $note) {
            $locked = $this->lockUndecided($dispute);

            if ($locked->status !== DisputeStatus::IN_PROGRESS || $locked->assigned_admin_id !== $admin->id) {
                throw ValidationException::withMessages(['dispute' => 'Prenez le litige en charge avant de rendre une décision.']);
            }

            $locked->update([
                'status' => DisputeStatus::DECIDED,
                'decision' => $decision,
                'decision_note' => $note,
                'decided_at' => now(),
            ]);
            $this->audit($admin, 'dispute.decided', $locked, "{$decision->value} — {$note}");
        });

        $dispute->refresh();
        Notification::send($this->parties($dispute), new DisputeDecidedNotification($dispute));

        return $dispute;
    }

    public function canView(User $user, Dispute $dispute): bool
    {
        return $user->hasRole(UserRole::Admin)
            || in_array($user->id, [$dispute->order->buyer?->user_id, $dispute->order->supplier?->user_id], true);
    }

    private function isBuyer(User $user, Order $order): bool
    {
        return $user->hasRole(UserRole::Buyer) && $user->buyerProfile?->id === $order->buyer_id;
    }

    private function lockUndecided(Dispute $dispute): Dispute
    {
        $locked = Dispute::query()->lockForUpdate()->findOrFail($dispute->id);

        if ($locked->status === DisputeStatus::DECIDED) {
            throw ValidationException::withMessages(['dispute' => 'Une décision a déjà été rendue pour ce litige.']);
        }

        return $locked;
    }

    private function audit(User $admin, string $action, Dispute $dispute, ?string $reason): void
    {
        AuditLog::create([
            'admin_id' => $admin->id,
            'action' => $action,
            'target' => "dispute:{$dispute->id}",
            'reason' => $reason,
        ]);
    }

    private function supplierUser(Dispute $dispute): ?User
    {
        return $dispute->order->supplier?->user;
    }

    /**
     * @return list<User>
     */
    private function parties(Dispute $dispute): array
    {
        return array_values(array_filter([$dispute->order->buyer?->user, $this->supplierUser($dispute)]));
    }

    /**
     * @return Collection<int, User>
     */
    private function activeAdmins()
    {
        return User::query()->where('role', UserRole::Admin)->where('status', UserStatus::ACTIVE)->get();
    }
}
