import { useId } from 'react'
import KpiIcon, { TONES } from './KpiIcon'

/** Petite courbe décorative sous la valeur ; rien n'est dessiné avec moins de deux points. */
function Sparkline({ values, color }) {
  const id = useId()
  if (!values || values.length < 2) return null

  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const points = values.map((value, index) => [
    (index / (values.length - 1)) * 100,
    26 - ((value - min) / range) * 22,
  ])
  const line = points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')

  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="mt-3 h-8 w-full" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,30 ${line} 100,30`} fill={`url(#${id})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/**
 * Carte d'indicateur colorée : icône dans un rond, libellé, valeur, précision et mini-courbe facultative.
 * trend : valeurs successives (par jour) pour la mini-courbe.
 */
export default function ColorKpiCard({ label, value, hint, icon, tone = 'violet', trend }) {
  const colors = TONES[tone] ?? TONES.violet

  return (
    <div className="flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <KpiIcon name={icon} tone={tone} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{label}</p>
          <p className="mt-0.5 text-2xl font-semibold tracking-tight text-ink tabular-nums">{value}</p>
          {hint && <p className={`mt-0.5 text-xs ${colors.text}`}>{hint}</p>}
        </div>
      </div>
      <div className="mt-auto">
        <Sparkline values={trend} color={colors.line} />
      </div>
    </div>
  )
}
