<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

/**
 * Journal des actions des administrateurs (table audit_logs, non modifiable) — SCRUM-118 / F24.
 */
class AuditLogger
{
    /**
     * @param  string  $target  type et identifiant, ex. « user:12 », « dispute:3 »
     */
    public function log(User $admin, string $action, string $target, ?string $reason = null): void
    {
        AuditLog::create([
            'admin_id' => $admin->id,
            'action' => $action,
            'target' => $target,
            'reason' => $reason,
        ]);
    }

    /**
     * Historique d'un ou plusieurs éléments, du plus récent au plus ancien.
     *
     * @param  list<string>  $targets
     * @return Collection<int, AuditLog>
     */
    public function historyOf(array $targets, int $limit = 20): Collection
    {
        return AuditLog::query()
            ->with(['admin' => fn ($query) => $query->withTrashed()->select(['id', 'name'])])
            ->whereIn('target', $targets)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit($limit)
            ->get();
    }
}
