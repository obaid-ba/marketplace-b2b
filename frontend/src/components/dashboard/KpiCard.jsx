/** Carte d'un indicateur clé (libellé, valeur déjà formatée, précision). */
export default function KpiCard({ label, value, hint }) {
  return (
    <div className="card">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-ink tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}
