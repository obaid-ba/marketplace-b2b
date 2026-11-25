<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Dashboard\PeriodRangeRequest;
use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Historique des actions d'administration (SCRUM-76).
 *
 * Lecture seule : le journal est immuable, aucune route de modification ou de
 * suppression n'existe. Filtres : administrateur, action, cible, période.
 */
class AuditLogController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'action' => ['nullable', 'string', 'max:60'],
            'target' => ['nullable', 'string', 'max:80'],
            'admin_id' => ['nullable', 'integer', 'exists:users,id'],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = AuditLog::query()->with('admin:id,name,email')->latest('id');

        if (! empty($filters['action'])) {
            $query->where('action', $filters['action']);
        }

        if (! empty($filters['target'])) {
            $query->where('target', 'like', addcslashes($filters['target'], '%_\\').'%');
        }

        if (! empty($filters['admin_id'])) {
            $query->where('admin_id', $filters['admin_id']);
        }

        if (! empty($filters['from'])) {
            $query->where('created_at', '>=', $this->day($filters['from'])->startOfDay()->setTimezone(config('app.timezone')));
        }

        if (! empty($filters['to'])) {
            $query->where('created_at', '<=', $this->day($filters['to'])->endOfDay()->setTimezone(config('app.timezone')));
        }

        return AuditLogResource::collection(
            $query->paginate((int) ($filters['per_page'] ?? 25))->withQueryString(),
        )->additional([
            // Valeurs présentes dans le journal, pour les filtres.
            'actions' => AuditLog::query()->distinct()->orderBy('action')->pluck('action'),
            'admins' => User::withTrashed()
                ->whereIn('id', AuditLog::query()->select('admin_id'))
                ->orderBy('name')
                ->get(['id', 'name']),
        ]);
    }

    /** Les dates des filtres sont en heure tunisienne, comme à l'écran. */
    private function day(string $date): CarbonImmutable
    {
        return CarbonImmutable::createFromFormat('Y-m-d', $date, PeriodRangeRequest::TIMEZONE);
    }
}
