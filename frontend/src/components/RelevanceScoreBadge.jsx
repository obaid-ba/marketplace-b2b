/**
 * Badge réutilisable du score de pertinence demande ↔ fournisseur (SCRUM-50).
 * Vert à partir de 80 %, orange à partir de 50 %, neutre en dessous.
 */
export default function RelevanceScoreBadge({ score, className = '' }) {
  if (score === null || score === undefined) {
    return (
      <span className={`inline-flex items-center rounded-full bg-page px-2.5 py-0.5 text-xs font-medium text-muted ${className}`}>
        Pertinence inconnue
      </span>
    )
  }

  const rounded = Math.round(Number(score))
  const tone =
    rounded >= 80
      ? 'bg-success-soft text-success'
      : rounded >= 50
        ? 'bg-accent-soft text-accent'
        : 'bg-page text-muted'

  return (
    <span
      title={`Score de pertinence calculé à partir de la catégorie, de la région et des mots-clés (${rounded} sur 100)`}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone} ${className}`}
    >
      <span aria-hidden="true">●</span>
      Pertinence {rounded} %
    </span>
  )
}
