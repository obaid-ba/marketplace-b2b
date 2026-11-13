import StatusBadge from '@/components/StatusBadge'
import { SUPPLIER_STATUS } from '@/utils/roles'
import { FieldError } from './Field'

const STATUS_LABELS = {
  [SUPPLIER_STATUS.VALIDATED]: 'Validé par l’admin',
  [SUPPLIER_STATUS.PENDING]: 'En attente',
  [SUPPLIER_STATUS.REJECTED]: 'Refusé',
}

const LOCKED_HINT = 'Disponible après validation de votre compte'

/** Statut de validation (lecture seule) + interrupteur « Profil publié » (bloqué tant que non validé). */
export default function ValidationCard({ profile, toggling, errors, onToggle }) {
  const locked = !profile.can_publish
  const checked = Boolean(profile.is_published)

  return (
    <section className="rounded-xl border border-line bg-surface p-5" aria-labelledby="validation-title">
      <h2 id="validation-title" className="mb-4 text-lg font-semibold text-ink">
        Validation et publication
      </h2>

      <div className="flex items-center justify-between gap-3 text-[15px]">
        <span className="text-muted">Statut de validation</span>
        <StatusBadge status={profile.validation_status}>{STATUS_LABELS[profile.validation_status]}</StatusBadge>
      </div>
      {profile.validation_status === SUPPLIER_STATUS.REJECTED && profile.rejection_reason && (
        <p className="mt-2 text-sm text-danger">Motif : {profile.rejection_reason}</p>
      )}

      <div className="mt-4 flex items-center justify-between gap-3 text-[15px]" title={locked ? LOCKED_HINT : undefined}>
        <span id="publish-label" className="text-ink">
          Profil publié
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-labelledby="publish-label"
          aria-describedby={locked ? 'publish-hint' : undefined}
          disabled={locked || toggling}
          onClick={() => onToggle(!checked)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:cursor-not-allowed ${
            checked ? 'bg-brand-600' : 'bg-line'
          } ${locked ? 'opacity-60' : ''}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'translate-x-5' : ''}`}
          />
        </button>
      </div>
      {locked && (
        <p id="publish-hint" className="mt-2 text-sm text-muted">
          {LOCKED_HINT}.
        </p>
      )}
      <FieldError messages={errors} />
    </section>
  )
}
