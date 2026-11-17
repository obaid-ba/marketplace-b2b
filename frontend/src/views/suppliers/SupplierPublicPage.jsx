import { useCallback, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { searchProducts } from '@/api/catalog'
import { fetchSupplier, fetchSupplierReviews } from '@/api/suppliers'
import EmptyState from '@/components/EmptyState'
import FavoriteButton from '@/components/FavoriteButton'
import Pagination from '@/components/Pagination'
import ProductCard, { ProductCardSkeleton } from '@/components/ProductCard'
import PublicNotFound from '@/components/PublicNotFound'
import ReviewItem from '@/components/ReviewItem'
import { formatNumber, formatRating } from '@/utils/format'
import { initialsOf } from '@/utils/initials'

/**
 * Fiche publique d'un fournisseur (SCRUM-37, maquette V4) : accessible sans connexion.
 * Onglets Produits / Avis / À propos dans l'URL (?tab=avis), pagination des produits et des avis (?page=2).
 */

const TABS = [
  { id: 'produits', label: 'Produits' },
  { id: 'avis', label: 'Avis' },
  { id: 'a-propos', label: 'À propos' },
]

const PRODUCTS_PER_PAGE = 12

function Card({ title, children }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="mb-3 text-[17px] font-semibold text-ink">{title}</h2>
      {children}
    </section>
  )
}

function About({ supplier }) {
  return (
    <>
      <Card title="À propos">
        <p className="text-[15px] leading-relaxed whitespace-pre-line text-muted">
          {supplier.description || 'Ce fournisseur n’a pas encore rédigé de présentation.'}
        </p>
      </Card>
      <Card title="Catégories proposées">
        {supplier.categories.length ? (
          <ul className="flex flex-wrap gap-2">
            {supplier.categories.map((category, index) => (
              <li
                key={category.id}
                className={`rounded-full px-3 py-1 text-xs ${index === 0 ? 'bg-info-soft text-info' : 'bg-page text-muted'}`}
              >
                {category.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Non renseignées.</p>
        )}
      </Card>
      <Card title="Zones couvertes">
        {supplier.coverage_regions.length ? (
          <ul className="space-y-2">
            {supplier.coverage_regions.map((region) => (
              <li key={region} className="flex items-center gap-2.5 text-[15px] text-ink">
                <span aria-hidden="true" className="grid h-4 w-4 place-items-center rounded bg-brand-600 text-[10px] text-white">
                  ✓
                </span>
                {region}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Non renseignées.</p>
        )}
      </Card>
    </>
  )
}

function ProductsTab({ supplierId, page, onPage }) {
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    setResult(null)
    setError(null)
    searchProducts({ supplier_id: supplierId, page, per_page: PRODUCTS_PER_PAGE }, { signal: controller.signal })
      .then(setResult)
      .catch((err) => !controller.signal.aborted && setError(err?.userMessage ?? 'Impossible de charger les produits.'))
    return () => controller.abort()
  }, [supplierId, page])

  if (error) return <EmptyState icon="!" title="Les produits n'ont pas pu être chargés" description={error} />
  if (!result) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    )
  }
  if (!result.data.length) return <EmptyState title="Aucun produit publié pour le moment" />

  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {result.data.map((product) => (
          <li key={product.id}>
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
      <Pagination className="mt-6" currentPage={result.meta.current_page} lastPage={result.meta.last_page} onChange={onPage} />
    </>
  )
}

function ReviewsTab({ supplier, page, onPage }) {
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    setResult(null)
    setError(null)
    fetchSupplierReviews(supplier.id, page)
      .then((data) => active && setResult(data))
      .catch((err) => active && setError(err?.userMessage ?? 'Impossible de charger les avis.'))
    return () => {
      active = false
    }
  }, [supplier.id, page])

  return (
    <section className="rounded-xl border border-line bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-ink">Avis des clients</h2>
        {supplier.ai_summary && (
          <span className="rounded-full bg-info-soft px-3 py-1 text-xs font-medium text-info">Résumé généré par IA</span>
        )}
      </div>
      {supplier.ai_summary && (
        <p className="mt-4 rounded-lg bg-info-soft px-4 py-3 text-sm text-ink">{supplier.ai_summary}</p>
      )}

      <div className="mt-2">
        {error ? (
          <p role="alert" className="py-6 text-sm text-danger">
            {error}
          </p>
        ) : !result ? (
          <div className="space-y-3 py-4" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-page" />
            ))}
          </div>
        ) : result.data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">Ce fournisseur n’a pas encore reçu d’avis.</p>
        ) : (
          <>
            {result.data.map((review) => (
              <ReviewItem key={review.id} review={review} supplierName={supplier.company_name} />
            ))}
            <Pagination className="mt-4" currentPage={result.meta.current_page} lastPage={result.meta.last_page} onChange={onPage} />
          </>
        )}
      </div>
    </section>
  )
}

export default function SupplierPublicPage() {
  const { supplierId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = TABS.some((t) => t.id === searchParams.get('tab')) ? searchParams.get('tab') : 'produits'
  const page = Math.max(1, Number(searchParams.get('page')) || 1)

  const [supplier, setSupplier] = useState(null)
  const [status, setStatus] = useState('loading') // loading | ready | not-found | error
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setStatus('loading')
    try {
      setSupplier(await fetchSupplier(supplierId))
      setStatus('ready')
    } catch (err) {
      if (err?.response?.status === 404) setStatus('not-found')
      else {
        setError(err?.userMessage ?? 'Impossible de charger ce fournisseur.')
        setStatus('error')
      }
    }
  }, [supplierId])

  useEffect(() => {
    load()
  }, [load])

  function selectTab(id) {
    setSearchParams(id === 'produits' ? {} : { tab: id })
  }

  function changePage(value) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (value > 1) next.set('page', String(value))
      else next.delete('page')
      return next
    })
  }

  if (status === 'not-found') {
    return <PublicNotFound title="Fournisseur introuvable" description="Ce fournisseur n’existe pas ou n’est plus visible sur la plateforme." />
  }

  if (status === 'error') {
    return (
      <div className="mx-auto max-w-[1276px] px-4 py-16 sm:px-6">
        <EmptyState
          icon="!"
          title="La fiche n'a pas pu être chargée"
          description={error}
          action={
            <button type="button" className="btn-primary" onClick={load}>
              Réessayer
            </button>
          }
        />
      </div>
    )
  }

  if (status === 'loading' || !supplier) {
    return (
      <div className="mx-auto max-w-[1276px] space-y-6 px-4 py-8 sm:px-6" aria-busy="true" aria-label="Chargement du fournisseur">
        <div className="h-36 animate-pulse rounded-xl bg-surface" />
        <div className="h-96 animate-pulse rounded-xl bg-surface" />
      </div>
    )
  }

  const counts = { produits: supplier.products_count, avis: supplier.reviews_count }

  return (
    <div className="mx-auto max-w-[1276px] space-y-6 px-4 py-8 sm:px-6">
      {/* En-tête */}
      <section className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-5 sm:p-7 md:flex-row md:items-center">
        {supplier.logo_url ? (
          <img src={supplier.logo_url} alt={`Logo de ${supplier.company_name}`} className="h-20 w-20 shrink-0 rounded-full object-cover sm:h-[86px] sm:w-[86px]" />
        ) : (
          <span className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-brand-50 text-2xl font-bold text-brand-600 sm:h-[86px] sm:w-[86px] sm:text-[28px]">
            {initialsOf(supplier.company_name)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-ink sm:text-[30px]">{supplier.company_name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="rounded-full bg-success-soft px-2.5 py-1 text-xs font-medium text-success">Fournisseur validé</span>
            <span className="text-muted">{[supplier.region, supplier.sector].filter(Boolean).join(' - ')}</span>
            {supplier.reviews_count > 0 && (
              <span className="font-semibold text-ink">
                ★ {formatRating(supplier.rating_avg)} ({formatNumber(supplier.reviews_count)} avis)
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <FavoriteButton supplierId={supplier.id} initialIsFavorite={supplier.is_favorite} />
          {/* Messagerie : S5 */}
          <button type="button" className="btn-primary px-5 py-2.5 font-semibold" disabled title="Bientôt disponible">
            Contacter
          </button>
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[350px_minmax(0,1fr)]">
        <aside className="hidden space-y-4 lg:block" aria-label="Présentation du fournisseur">
          <About supplier={supplier} />
        </aside>

        <div className="min-w-0">
          <div role="tablist" aria-label="Sections de la fiche" className="mb-6 flex gap-6 overflow-x-auto border-b border-line">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => selectTab(item.id)}
                className={`-mb-px border-b-2 pb-3 text-[15px] whitespace-nowrap ${
                  tab === item.id ? 'border-brand-600 font-semibold text-brand-600' : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                {item.label}
                {item.id in counts ? ` (${formatNumber(counts[item.id])})` : ''}
              </button>
            ))}
          </div>

          <div role="tabpanel">
            {tab === 'produits' && <ProductsTab supplierId={supplier.id} page={page} onPage={changePage} />}
            {tab === 'avis' && <ReviewsTab supplier={supplier} page={page} onPage={changePage} />}
            {tab === 'a-propos' && (
              <div className="space-y-4">
                <About supplier={supplier} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
