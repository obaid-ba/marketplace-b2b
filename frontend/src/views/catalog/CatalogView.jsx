import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { fetchRegions, searchProducts } from '@/api/catalog'
import { fetchCategories } from '@/api/categories'
import EmptyState from '@/components/EmptyState'
import Pagination from '@/components/Pagination'
import ProductCard, { ProductCardSkeleton } from '@/components/ProductCard'
import { pluralize } from '@/utils/format'
import CatalogFilters from './CatalogFilters'
import {
  FILTER_KEYS,
  SORT_OPTIONS,
  activeFilterCount,
  applyChanges,
  readFilters,
  toApiParams,
} from './catalogParams'

/**
 * Catalogue public (SCRUM-35, maquette V2) : recherche, filtres combinables, tri, pagination.
 * Les filtres vivent dans l'URL : lien partageable, bouton Retour du navigateur fonctionnel.
 */
export default function CatalogView() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo(() => readFilters(searchParams), [searchParams])
  const apiParams = useMemo(() => toApiParams(filters), [filters])
  const apiKey = JSON.stringify(apiParams)

  const [categories, setCategories] = useState([])
  const [regions, setRegions] = useState([])
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [query, setQuery] = useState(filters.q)
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => setQuery(filters.q), [filters.q])

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => setCategories([]))
    fetchRegions().then(setRegions).catch(() => setRegions([]))
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    searchProducts(JSON.parse(apiKey), { signal: controller.signal })
      .then((data) => {
        setResult(data)
        setLoading(false)
      })
      .catch((err) => {
        if (controller.signal.aborted || err?.code === 'ERR_CANCELED') return
        setError(err?.userMessage ?? 'Impossible de charger le catalogue.')
        setLoading(false)
      })
    return () => controller.abort()
  }, [apiKey, reloadKey])

  const update = useCallback(
    (changes) => setSearchParams((current) => applyChanges(current, changes)),
    [setSearchParams],
  )

  function resetFilters() {
    update(Object.fromEntries(FILTER_KEYS.map((key) => [key, ''])))
  }

  function changePage(page) {
    update({ page })
    window.scrollTo?.({ top: 0, behavior: 'smooth' })
  }

  function submitSearch(event) {
    event.preventDefault()
    // Sans mots-clés, « Pertinence » n'a plus de sens : on revient au tri par défaut.
    update({ q: query.trim(), ...(filters.sort === 'relevance' && !query.trim() ? { sort: '' } : {}) })
  }

  const count = activeFilterCount(filters)
  const products = result?.data ?? []
  const total = result?.meta?.total ?? 0

  const filterPanel = (idPrefix) => (
    <CatalogFilters
      idPrefix={idPrefix}
      filters={filters}
      categories={categories}
      regions={regions}
      onChange={update}
      onReset={resetFilters}
    />
  )

  return (
    <div className="mx-auto max-w-[1276px] px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-[28px] font-bold text-ink sm:text-[32px]">Catalogue</h1>

      <form
        role="search"
        onSubmit={submitSearch}
        className="mt-5 flex items-center gap-2 rounded-xl border border-line bg-surface p-2 pl-4"
      >
        <label htmlFor="catalog-search" className="sr-only">
          Rechercher un produit ou un service
        </label>
        <input
          id="catalog-search"
          type="search"
          value={query}
          maxLength={100}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher un produit ou un service"
          className="min-w-0 flex-1 bg-transparent py-2 text-[15px] outline-none placeholder:text-muted"
        />
        <button type="submit" className="btn-primary shrink-0 px-5 py-2.5 font-semibold">
          Rechercher
        </button>
      </form>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[272px_minmax(0,1fr)]">
        {/* Filtres : colonne sur grand écran */}
        <aside aria-label="Filtres" className="hidden rounded-xl border border-line bg-surface p-5 lg:block">
          {filterPanel('desktop')}
        </aside>

        <section aria-labelledby="catalog-results" className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p id="catalog-results" className="text-[15px] font-medium text-ink" aria-live="polite">
              {loading && !result ? 'Recherche…' : pluralize(total, 'résultat')}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-secondary lg:hidden"
                onClick={() => setFiltersOpen(true)}
                aria-haspopup="dialog"
              >
                Filtres{count > 0 ? ` (${count})` : ''}
              </button>
              <label className="flex items-center gap-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm">
                <span className="text-muted">Trier par :</span>
                <select
                  aria-label="Trier par"
                  className="bg-transparent font-medium text-ink outline-none"
                  value={filters.sort}
                  onChange={(event) => update({ sort: event.target.value })}
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="mt-4">
            {error ? (
              <EmptyState
                icon="!"
                title="Le catalogue n'a pas pu être chargé"
                description={error}
                action={
                  <button type="button" className="btn-primary" onClick={() => setReloadKey((k) => k + 1)}>
                    Réessayer
                  </button>
                }
              />
            ) : loading ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Chargement des produits">
                {Array.from({ length: 6 }, (_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            ) : products.length === 0 ? (
              <EmptyState
                title="Aucun produit ne correspond à votre recherche"
                description="Essayez d'autres mots-clés ou retirez quelques filtres."
                action={
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => update({ q: '', ...Object.fromEntries(FILTER_KEYS.map((key) => [key, ''])) })}
                  >
                    Réinitialiser la recherche
                  </button>
                }
              />
            ) : (
              <>
                <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {products.map((product) => (
                    <li key={product.id}>
                      <ProductCard product={product} />
                    </li>
                  ))}
                </ul>
                <Pagination
                  className="mt-8"
                  currentPage={result.meta.current_page}
                  lastPage={result.meta.last_page}
                  onChange={changePage}
                />
              </>
            )}
          </div>
        </section>
      </div>

      {/* Filtres : panneau plein écran sur mobile */}
      {filtersOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Fermer les filtres"
            className="absolute inset-0 bg-ink/40"
            onClick={() => setFiltersOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filtres"
            className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-surface shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="text-lg font-semibold">Filtres{count > 0 ? ` (${count})` : ''}</h2>
              <button type="button" className="btn-ghost px-2" onClick={() => setFiltersOpen(false)} aria-label="Fermer">
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">{filterPanel('mobile')}</div>
            <div className="border-t border-line p-4">
              <button type="button" className="btn-primary w-full py-2.5" onClick={() => setFiltersOpen(false)}>
                {loading ? 'Recherche…' : `Voir ${pluralize(total, 'résultat')}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
