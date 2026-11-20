/**
 * État vide réutilisable : aucun résultat, aucun favori, aucun avis…
 * action : bouton ou lien optionnel affiché sous le texte.
 */
export default function EmptyState({ title, description, action, icon = '○', className = '' }) {
  return (
    <div className={`rounded-xl border border-dashed border-line bg-surface px-6 py-12 text-center ${className}`}>
      <span
        aria-hidden="true"
        className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-xl text-brand-600"
      >
        {icon}
      </span>
      <p className="font-semibold text-ink">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}
