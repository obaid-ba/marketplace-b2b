import PeriodPicker from '@/components/dashboard/PeriodPicker'
import { formatDate, toDateInputValue } from '@/utils/period'

/** Raccourcis de période : nombre de jours jusqu'à aujourd'hui inclus (l'API accepte 366 jours au plus). */
const PRESETS = [
  { label: '30 jours', days: 30 },
  { label: '3 mois', days: 90 },
  { label: '1 an', days: 365 },
]

function lastDays(days, today = new Date()) {
  const from = new Date(today)
  from.setDate(from.getDate() - (days - 1))
  return { from: toDateInputValue(from), to: toDateInputValue(today) }
}

/**
 * Carte « Période analysée » commune aux tableaux de bord : dates, bouton Actualiser et raccourcis.
 * period : { from, to } ; onChange(range) reçoit la nouvelle période.
 */
export default function DashboardPeriod({ period, onChange, loading }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm" aria-labelledby="period-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="period-title" className="flex items-center gap-2 text-sm font-semibold text-ink">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5 text-brand-600" aria-hidden="true">
            <rect x="4" y="5" width="16" height="16" rx="2" />
            <path d="M16 3v4M8 3v4M4 11h16" />
          </svg>
          Période analysée
        </h2>
        <p className="text-xs text-muted">
          {formatDate(period.from)} — {formatDate(period.to)}
        </p>
      </div>
      <div className="mt-3 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex-1 xl:max-w-2xl">
          <PeriodPicker from={period.from} to={period.to} onApply={onChange} loading={loading} />
        </div>
        <div role="group" aria-label="Raccourcis de période" className="flex gap-2">
          {PRESETS.map((preset) => {
            const range = lastDays(preset.days)
            const active = range.from === period.from && range.to === period.to
            return (
              <button
                key={preset.days}
                type="button"
                aria-pressed={active}
                onClick={() => onChange(range)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  active ? 'bg-brand-600 text-white shadow-sm' : 'border border-line bg-surface text-ink hover:bg-page'
                }`}
              >
                {preset.label}
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
