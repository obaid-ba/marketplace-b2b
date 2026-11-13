/** Réputation (lecture seule) : note moyenne et nombre d'avis, calculés à partir des avis (EP07). */
export default function ReputationCard({ rating, count }) {
  const formatted = Number(rating ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

  return (
    <section className="rounded-xl border border-line bg-surface p-5" aria-labelledby="reputation-title">
      <h2 id="reputation-title" className="mb-2 text-lg font-semibold text-ink">
        Réputation
      </h2>
      {count > 0 ? (
        <p className="text-2xl font-semibold text-brand-600">
          {formatted} / 5 - {count} avis
        </p>
      ) : (
        <p className="text-[15px] text-muted">Pas encore d’avis.</p>
      )}
    </section>
  )
}
