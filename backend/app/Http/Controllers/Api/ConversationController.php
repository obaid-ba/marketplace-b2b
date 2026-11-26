<?php

namespace App\Http\Controllers\Api;

use App\Enums\ConversationContext;
use App\Http\Controllers\Controller;
use App\Http\Requests\Messaging\OpenConversationRequest;
use App\Http\Requests\Messaging\SendMessageRequest;
use App\Http\Resources\ConversationResource;
use App\Http\Resources\MessageResource;
use App\Models\Conversation;
use App\Models\Message;
use App\Services\ConversationService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Messagerie entre porteurs et fournisseurs (SCRUM-59, SCRUM-60, SCRUM-61 / F21, F22).
 * Une conversation dont on ne fait pas partie répond 404 : son existence n'est pas révélée.
 */
class ConversationController extends Controller
{
    private const MESSAGES_PER_PAGE = 30;

    public function __construct(private readonly ConversationService $service) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $user = $request->user();

        $conversations = Conversation::query()
            ->forUser($user)
            // Une conversation ouverte sans message n'apparaît pas encore dans la liste.
            ->whereNotNull('last_message_at')
            ->with(['buyer.user:id,name', 'supplier', 'latestMessage', 'participants'])
            ->withUnreadCountFor($user)
            ->when($request->boolean('unread'), fn (Builder $query) => $query->whereHas('messages', fn (Builder $message) => $message->unreadBy($user)))
            ->when($request->filled('search'), function (Builder $query) use ($request) {
                $term = '%'.addcslashes($request->string('search')->toString(), '%_\\').'%';

                $query->where(fn (Builder $q) => $q
                    ->whereHas('messages', fn (Builder $message) => $message
                        ->where('body', 'like', $term)
                        ->orWhere('attachment_name', 'like', $term))
                    ->orWhereHas('supplier', fn (Builder $supplier) => $supplier->where('company_name', 'like', $term))
                    ->orWhereHas('buyer', fn (Builder $buyer) => $buyer
                        ->where('organization', 'like', $term)
                        ->orWhereHas('user', fn (Builder $owner) => $owner->where('name', 'like', $term))));
            })
            ->orderByDesc('last_message_at')
            ->orderByDesc('id')
            ->paginate(max(1, min(50, $request->integer('per_page', 20))));

        ConversationResource::loadContexts($conversations->getCollection());

        return ConversationResource::collection($conversations);
    }

    public function unreadCount(Request $request): JsonResponse
    {
        return response()->json(['count' => $this->service->unreadTotal($request->user())]);
    }

    public function store(OpenConversationRequest $request): JsonResponse
    {
        $conversation = $this->service->open(
            $request->user(),
            ConversationContext::from($request->validated('context_type')),
            $request->validated('context_id'),
            $request->validated('supplier_id'),
        );

        return $this->resource($request, $conversation)
            ->response()
            ->setStatusCode($conversation->wasRecentlyCreated ? 201 : 200);
    }

    public function show(Request $request, int $conversation): ConversationResource
    {
        return $this->resource($request, $this->find($request, $conversation));
    }

    /**
     * Messages du plus ancien au plus récent. ?before=id : page précédente ; ?after=id : nouveaux messages.
     */
    public function messages(Request $request, int $conversation): JsonResponse
    {
        $model = $this->find($request, $conversation);
        $before = $request->integer('before');
        $after = $request->integer('after');

        if ($after > 0) {
            $messages = $model->messages()->where('id', '>', $after)->orderBy('id')->limit(100)->get();
            $hasMore = false;
        } else {
            $messages = $model->messages()
                ->when($before > 0, fn ($query) => $query->where('id', '<', $before))
                ->orderByDesc('id')
                ->limit(self::MESSAGES_PER_PAGE + 1)
                ->get();

            $hasMore = $messages->count() > self::MESSAGES_PER_PAGE;
            $messages = $messages->take(self::MESSAGES_PER_PAGE)->reverse()->values();
        }

        return response()->json([
            'data' => MessageResource::collection($messages),
            'has_more' => $hasMore,
        ]);
    }

    public function send(SendMessageRequest $request, int $conversation): JsonResponse
    {
        $message = $this->service->send(
            $this->find($request, $conversation),
            $request->user(),
            $request->validated('body'),
            $request->file('attachment'),
        );

        return (new MessageResource($message))->response()->setStatusCode(201);
    }

    public function markRead(Request $request, int $conversation): JsonResponse
    {
        $this->service->markRead($this->find($request, $conversation), $request->user());

        return response()->json(['unread_total' => $this->service->unreadTotal($request->user())]);
    }

    public function attachment(Request $request, int $conversation, int $message): StreamedResponse
    {
        /** @var Message $model */
        $model = $this->find($request, $conversation)->messages()->whereNotNull('attachment_path')->findOrFail($message);
        $disk = Storage::disk(ConversationService::ATTACHMENT_DISK);

        abort_unless($disk->exists($model->attachment_path), 404, "Ce fichier n'est plus disponible.");

        return $disk->download($model->attachment_path, $model->attachment_name, ['X-Content-Type-Options' => 'nosniff']);
    }

    private function find(Request $request, int $id): Conversation
    {
        return Conversation::query()->forUser($request->user())->findOrFail($id);
    }

    private function resource(Request $request, Conversation $conversation): ConversationResource
    {
        $wasCreated = $conversation->wasRecentlyCreated;

        $conversation = Conversation::query()
            ->with(['buyer.user:id,name', 'supplier', 'latestMessage', 'participants'])
            ->withUnreadCountFor($request->user())
            ->findOrFail($conversation->id);

        $conversation->wasRecentlyCreated = $wasCreated;
        ConversationResource::loadContexts(collect([$conversation]));

        return new ConversationResource($conversation);
    }
}
