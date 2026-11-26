<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\NotificationResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Centre de notifications de l'utilisateur connecté (SCRUM-62 / F15).
 */
class NotificationController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $notifications = $request->user()
            ->notifications()
            ->latest()
            ->paginate(max(1, min(50, $request->integer('per_page', 20))));

        return NotificationResource::collection($notifications);
    }

    public function unreadCount(Request $request): JsonResponse
    {
        return response()->json([
            'count' => $request->user()->unreadNotifications()->count(),
        ]);
    }

    public function markRead(Request $request, string $notification): JsonResponse
    {
        $model = $request->user()
            ->notifications()
            ->whereKey($notification)
            ->firstOrFail();

        if (! $model->read_at) {
            $model->markAsRead();
        }

        return response()->json([
            'message' => 'Notification marquée comme lue.',
            'unread_count' => $request->user()->unreadNotifications()->count(),
        ]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return response()->json([
            'message' => 'Toutes les notifications sont marquées comme lues.',
            'unread_count' => 0,
        ]);
    }
}
