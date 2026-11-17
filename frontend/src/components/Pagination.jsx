/**
 * Pagination ‹ 1 2 3 … 25 › (maquettes V2, F2).
 * Affiche toujours la première et la dernière page, et les pages voisines de la page courante.
 */
export function pageItems(current, last) {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1)

  const pages = new Set([1, last, current - 1, current, current + 1])
  if (current <= 3) [2, 3, 4].forEach((p) => pages.add(p))
  if (current >= last - 2) [last - 3, last - 2, last - 1].forEach((p) => pages.add(p))

  const sorted = [...pages].filter((p) => p >= 1 && p <= last).sort((a, b) => a - b)
  const items = []
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) items.push(`gap-${page}`)
    items.push(page)
  })
  return items
}

const base = 'grid h-9 min-w-9 place-items-center rounded-lg border px-2 text-sm font-medium transition'

export default function Pagination({ currentPage, lastPage, onChange, className = '' }) {
  if (!lastPage || lastPage <= 1) return null

  return (
    <nav aria-label="Pagination" className={`flex flex-wrap items-center justify-center gap-2 ${className}`}>
      <button
        type="button"
        className={`${base} border-line bg-surface text-ink hover:bg-page disabled:opacity-40`}
        onClick={() => onChange(currentPage - 1)}
        disabled={currentPage <= 1}
        aria-label="Page précédente"
      >
        ‹
      </button>
      {pageItems(currentPage, lastPage).map((item) =>
        typeof item === 'string' ? (
          <span key={item} className={`${base} border-line bg-surface text-muted`} aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            aria-current={item === currentPage ? 'page' : undefined}
            aria-label={`Page ${item}`}
            className={`${base} ${
              item === currentPage
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-line bg-surface text-ink hover:bg-page'
            }`}
          >
            {item}
          </button>
        ),
      )}
      <button
        type="button"
        className={`${base} border-line bg-surface text-ink hover:bg-page disabled:opacity-40`}
        onClick={() => onChange(currentPage + 1)}
        disabled={currentPage >= lastPage}
        aria-label="Page suivante"
      >
        ›
      </button>
    </nav>
  )
}
