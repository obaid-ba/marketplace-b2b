<?php

namespace App\Http\Controllers\Api\Buyer;

use App\Enums\DisputeStatus;
use App\Enums\OrderStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\Dispute;
use App\Models\DisputeAttachment;
use App\Models\Order;
use App\Models\User;
use App\Notifications\DisputeOpenedNotification;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Litiges côté porteur de projet (SCRUM-67 / F21).
 *
 * Un litige ne peut être ouvert qu'entre l'expédition et la livraison
 * (statuts `expédiée` ou `livrée`) : jamais après la clôture. Une seule
 * procédure non décidée est autorisée par commande.
 */
class DisputeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $buyer = $request->user()->buyerProfile;

        if (! $buyer) {
            return response()->json(['message' => 'Profil acheteur introuvable.'], 403);
        }

        $disputes = Dispute::query()
            ->whereHas('order', fn ($query) => $query->where('buyer_id', $buyer->id))
            ->with([
                'order:id,supplier_id,total,status,created_at',
                'order.supplier:id,company_name',
                'attachments',
                'assignedAdmin:id,name',
            ])
            ->latest('id')
            ->paginate(max(1, min(50, (int) $request->query('per_page', 15))));

        return response()->json($disputes);
    }

    public function store(Request $request, Order $order): JsonResponse
    {
        $buyer = $request->user()->buyerProfile;

        if (! $buyer || $order->buyer_id !== $buyer->id) {
            return response()->json(['message' => 'Action non autorisée sur cette commande.'], 403);
        }

        if (! in_array($order->status, [OrderStatus::SHIPPED, OrderStatus::DELIVERED], true)) {
            return response()->json([
                'message' => 'Un litige ne peut être ouvert qu\'après l\'expédition et avant la clôture de la commande.',
            ], 422);
        }

        $alreadyOpen = Dispute::query()
            ->where('order_id', $order->id)
            ->where('status', '!=', DisputeStatus::DECIDED->value)
            ->exists();

        if ($alreadyOpen) {
            return response()->json([
                'message' => 'Un litige est déjà en cours pour cette commande.',
            ], 422);
        }

        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:5', 'max:255'],
            'description' => ['required', 'string', 'min:10', 'max:5000'],
            'attachments' => ['nullable', 'array', 'max:5'],
            'attachments.*' => ['file', 'mimes:pdf,jpg,jpeg,png', 'max:5120'],
        ]);

        $dispute = DB::transaction(function () use ($request, $order, $validated) {
            $dispute = Dispute::create([
                'order_id' => $order->id,
                'opened_by' => $request->user()->id,
                'reason' => $validated['reason'],
                'description' => $validated['description'],
                'status' => DisputeStatus::OPEN,
            ]);

            foreach ($request->file('attachments', []) as $file) {
                $dispute->attachments()->create([
                    'file_path' => $file->store("disputes/{$dispute->id}", 'local'),
                ]);
            }

            return $dispute;
        });

        $dispute->load(['order.supplier.user', 'order.buyer.user', 'attachments']);

        // L'administration et le fournisseur sont informés immédiatement.
        User::query()
            ->where('role', UserRole::Admin->value)
            ->get()
            ->each(fn (User $admin) => $admin->notify(new DisputeOpenedNotification($dispute)));

        if ($dispute->order?->supplier?->user) {
            $dispute->order->supplier->user->notify(new DisputeOpenedNotification($dispute));
        }

        return response()->json([
            'message' => 'Votre litige a été ouvert. L\'administration et le fournisseur ont été informés.',
            'dispute' => $dispute,
        ], 201);
    }

    public function downloadAttachment(Request $request, Dispute $dispute, DisputeAttachment $attachment): StreamedResponse|JsonResponse
    {
        $buyer = $request->user()->buyerProfile;

        if (! $buyer || $dispute->order?->buyer_id !== $buyer->id || $attachment->dispute_id !== $dispute->id) {
            return response()->json(['message' => 'Pièce jointe introuvable.'], 404);
        }

        return $this->serve($attachment);
    }

    private function serve(DisputeAttachment $attachment): StreamedResponse|JsonResponse
    {
        /** @var FilesystemAdapter $disk */
        $disk = Storage::disk('local');

        if (! $disk->exists($attachment->file_path)) {
            return response()->json(['message' => 'Le fichier demandé est introuvable.'], 404);
        }

        return $disk->download($attachment->file_path, basename($attachment->file_path));
    }
}
