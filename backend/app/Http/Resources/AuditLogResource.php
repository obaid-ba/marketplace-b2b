<?php

namespace App\Http\Resources;

use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Entrée du journal d'audit (SCRUM-76).
 *
 * @mixin AuditLog
 */
class AuditLogResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'action' => $this->action,
            'target' => $this->target,
            'reason' => $this->reason,
            'created_at' => $this->created_at?->toIso8601String(),
            'admin' => $this->whenLoaded('admin', fn () => $this->admin?->only(['id', 'name', 'email'])),
        ];
    }
}
