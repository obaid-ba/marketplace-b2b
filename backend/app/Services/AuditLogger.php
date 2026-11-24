<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;

/**
 * Journal d'audit des actions d'administration (SCRUM-76).
 *
 * Chaque action d'un administrateur sur une ressource sensible (validation,
 * catalogue, avis, litiges, comptes, export) doit laisser une trace immuable :
 * qui, quoi, sur quoi, pourquoi et quand. La table `audit_logs` ne possède pas
 * de `updated_at` : une entrée n'est jamais modifiée ni supprimée.
 */
class AuditLogger
{
    /**
     * Enregistre une action d'administration.
     *
     * @param  string  $target  ressource visée, au format `type:id` (ex. `product:12`)
     */
    public function record(User $admin, string $action, string $target, ?string $reason = null): AuditLog
    {
        return AuditLog::create([
            'admin_id' => $admin->id,
            'action' => $action,
            'target' => $target,
            'reason' => $reason,
        ]);
    }
}
