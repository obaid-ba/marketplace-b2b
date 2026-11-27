import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { searchProducts } from '@/api/catalog'
import ProductCard, { ProductCardSkeleton } from '@/components/ProductCard'
import { catalogPath } from '@/router/paths'
import { LineIcon } from './HomeIllustrations'

const PER_PAGE = 8

/**
 * Aperçu du catalogue sur la page d'accueil : derniers produits avec leurs photos, filtrables par catégorie.
 * categories : catégories principales déjà chargées par la page (pastilles de filtre).
 */
export default function HomeCatalog({ categories = [] }) {
  const [category, setCategory] = useState('')
  const [state, setState] = useState({ loading: true, products: [], total: 0, failed: false })

  useEffect(() => {
    const controller = new AbortController()
    setState((current) => ({ ...current, loading: true, failed: false }))
    searchProducts({ per_page: PER_PAGE, category: category || undefined }, { signal: controller.signal })
      .then((page) =>
        setState({ loading: false, products: page?.data ?? [], total: page?.meta?.total ?? page?.data?.length ?? 0, failed: false }),
      )
      .catch((error) => {
        if (error?.name === 'CanceledError' || error?.name === 'AbortError') return
        setState({ loading: false, products: [], total: 0, failed: true })
      })
    return () => controller.abort()
  }, [category])

  const chips = [{ id: '', name: 'Tous' }, ...categories.filter((item) => (item.products_count ?? 0) > 0).slice(0, 6)]

  return (
    <section className="mx-auto max-w-[1276px] px-4 pb-6 sm:px-6" aria-labelledby="home-catalog">
      <div className="rounded-3xl border border-white/70 bg-surface/80 p-6 shadow-[0_10px_40px_-20px_rgba(91,75,219,0.35)] sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="home-catalog" className="text-2xl font-bold text-ink sm:text-[28px]">
              Catalogue des produits
            </h2>
            <p className="mt-1 text-sm text-muted">
              {state.total > 0 ? `${state.total} produits et services proposés par des fournisseurs validés` : 'Produits et services proposés par des fournisseurs validés'}
            </p>
          </div>
          <Link
            to={catalogPath({ category: category || undefined })}
            className="inline-flex items-center gap-2 self-start rounded-xl border border-brand-100 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-600 transition hover:bg-brand-100 sm:self-auto"
          >
            Voir tout le catalogue
            <LineIcon name="arrow" className="h-4 w-4" />
          </Link>
        </div>

        {chips.length > 1 && (
          <div role="group" aria-label="Filtrer par catégorie" className="mt-5 flex flex-wrap gap-2">
            {chips.map((chip) => {
              const active = String(chip.id) === String(category)
              return (
                <button
                  key={chip.id || 'all'}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCategory(String(chip.id))}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                    active ? 'bg-brand-600 text-white shadow-sm' : 'border border-line bg-surface text-ink hover:border-brand-100 hover:text-brand-600'
                  }`}
                >
                  {chip.name}
                </button>
              )
            })}
          </div>
        )}

        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy={state.loading}>
          {state.loading
            ? Array.from({ length: PER_PAGE }, (_, i) => (
                <li key={i}>
                  <ProductCardSkeleton />
                </li>
              ))
            : state.products.map((product) => (
                <li key={product.id}>
                  <ProductCard product={product} />
                </li>
              ))}
        </ul>

        {!state.loading && state.products.length === 0 && (
          <p className="mt-6 text-sm text-muted">
            {state.failed ? 'Le catalogue n’a pas pu être chargé.' : 'Aucun produit dans cette catégorie pour le moment.'}{' '}
            <Link to={catalogPath()} className="font-medium text-brand-600 hover:underline">
              Ouvrir le catalogue
            </Link>
          </p>
        )}
      </div>
    </section>
  )
}
