/**
 * « Ce que les clients en disent » (SCRUM-83 / F32) : synthèse, points forts et points faibles tirés des avis.
 * summary : { summary, strengths, weaknesses, reviews_count, simulated } ou null (moins de 3 avis : rien n'est affiché).
 */
export default function ReviewInsights({ summary, className = '' }) {
  if (!summary) return null

  return (
    <section aria-labelledby="review-insights-title" className={`rounded-xl border border-info-soft bg-info-soft/50 p-4 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="review-insights-title" className="font-semibold text-ink">
          Ce que les clients en disent
        </h3>
        <span className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-info">
          {summary.simulated ? 'Résumé automatique (mode simulé)' : 'Résumé généré par IA'}
        </span>
      </div>
      <p className="mt-2 text-sm text-ink">{summary.summary}</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold text-success">Points forts</p>
          {summary.strengths.length ? (
            <ul className="mt-1 space-y-0.5 text-sm text-ink">
              {summary.strengths.map((item) => (
                <li key={item}>+ {item}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-muted">Aucun point fort récurrent.</p>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold text-danger">Points faibles</p>
          {summary.weaknesses.length ? (
            <ul className="mt-1 space-y-0.5 text-sm text-ink">
              {summary.weaknesses.map((item) => (
                <li key={item}>– {item}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-muted">Aucun point faible récurrent.</p>
          )}
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">Basé sur les {summary.reviews_count} derniers avis publiés.</p>
    </section>
  )
}
