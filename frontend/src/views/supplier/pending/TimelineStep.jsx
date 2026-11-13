import StatusBadge from '@/components/StatusBadge'

/**
 * Une étape de la frise du dossier fournisseur (SCRUM-27).
 * state : 'done' (coche verte) | 'current' (pastille orange) | 'upcoming' (pastille grise) | 'rejected' (pastille rouge)
 */
const STATES = {
  done: { badge: 'success', label: 'Terminé', dot: 'bg-success text-white' },
  current: { badge: 'pending', label: 'En cours', dot: 'bg-accent-strong text-white' },
  upcoming: { badge: 'neutral', label: 'À venir', dot: 'border border-line bg-page text-muted' },
  rejected: { badge: 'danger', label: 'Refusé', dot: 'bg-danger text-white' },
}

export default function TimelineStep({ state, number, title, subtitle }) {
  const config = STATES[state] ?? STATES.upcoming

  return (
    <li className="flex items-center gap-3.5 border-b border-line py-3.5 last:border-b-0" aria-current={state === 'current' ? 'step' : undefined}>
      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${config.dot}`} aria-hidden="true">
        {state === 'done' ? (
          <svg viewBox="0 0 16 16" className="h-3 w-3">
            <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          number
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium text-ink">{title}</p>
        {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
      </div>

      <StatusBadge variant={config.badge}>{config.label}</StatusBadge>
    </li>
  )
}
