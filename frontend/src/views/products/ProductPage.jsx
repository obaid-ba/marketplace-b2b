import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { searchProducts } from '@/api/catalog'
import { fetchProduct } from '@/api/products'
import EmptyState from '@/components/EmptyState'
import ProductCard from '@/components/ProductCard'
import ProductImagePlaceholder from '@/components/ProductImagePlaceholder'
import PublicNotFound from '@/components/PublicNotFound'
import ReviewItem from '@/components/ReviewItem'
import StarRating from '@/components/StarRating'
import { catalogPath, PATHS, supplierPublicPath } from '@/router/paths'
import { formatNumber, formatPrice, formatRating, pluralize } from '@/utils/format'
import { initialsOf } from '@/utils/initials'
import OrderBox from './OrderBox'

/**
 * Fiche détaillée d'un produit (SCRUM-36, maquette V3) : accessible sans connexion.
 * Commande directe (SCRUM-51) : voir OrderBox.
 */

function Gallery({ product }) {
  const [active, setActive] = useState(0)
  const images = product.images
  const current = images[active]

  return (
    <div className="space-y-3">
      <div className="aspect-[3/2] overflow-hidden rounded-xl">
        {current ? (
          <img src={current.url} alt={product.title} className="h-full w-full object-cover" />
        ) : (
          <ProductImagePlaceholder seed={product.id} label="Image principale" className="h-full w-full text-sm" />
        )}
      </div>
      {images.length > 1 && (
        <ul className="grid grid-cols-4 gap-3" aria-label="Photos du produit">
          {images.slice(0, 4).map((image, index) => (
            <li key={image.id}>
              <button
                type="button"
                onClick={() => setActive(index)}
                aria-label={`Afficher la photo ${index + 1}`}
                aria-pressed={index === active}
                className={`block aspect-[3/2] w-full overflow-hidden rounded-lg ring-offset-2 transition ${
                  index === active ? 'ring-2 ring-brand-600' : 'opacity-80 hover:opacity-100'
                }`}
              >
                <img src={image.url} alt="" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line py-3 text-[15px] last:border-b-0">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right text-ink">{value}</dd>
    </div>
  )
}

function SimilarProducts({ product }) {
  const [items, setItems] = useState(null)

  useEffect(() => {
    if (!product.category) return undefined
    const controller = new AbortController()
    searchProducts({ category: product.category.id, exclude: product.id, per_page: 4 }, { signal: controller.signal })
      .then((data) => setItems(data.data))
      .catch(() => setItems([]))
    return () => controller.abort()
  }, [product.id, product.category])

  if (!items?.length) return null

  return (
    <section aria-labelledby="similar-title">
      <h2 id="similar-title" className="mb-4 text-xl font-semibold text-ink">
        Produits similaires
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <li key={item.id}>
            <ProductCard product={item} />
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function ProductPage() {
  const { productId } = useParams()
  const [product, setProduct] = useState(null)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setStatus('loading')
    try {
      setProduct(await fetchProduct(productId))
      setStatus('ready')
    } catch (err) {
      if (err?.response?.status === 404) setStatus('not-found')
      else {
        setError(err?.userMessage ?? 'Impossible de charger ce produit.')
        setStatus('error')
      }
    }
  }, [productId])

  useEffect(() => {
    load()
    window.scrollTo?.(0, 0)
  }, [load])

  if (status === 'not-found') {
    return <PublicNotFound title="Produit introuvable" description="Ce produit n’existe pas ou n’est plus proposé dans le catalogue." />
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

  if (status === 'loading' || !product) {
    return (
      <div className="mx-auto grid max-w-[1276px] gap-8 px-4 py-8 sm:px-6 lg:grid-cols-2" aria-busy="true" aria-label="Chargement du produit">
        <div className="aspect-[3/2] animate-pulse rounded-xl bg-surface" />
        <div className="h-96 animate-pulse rounded-xl bg-surface" />
      </div>
    )
  }

  const { supplier, category } = product
  const rootCategory = category?.parent ?? category
  const isService = product.type === 'service'

  return (
    <div className="mx-auto max-w-[1276px] space-y-10 px-4 py-8 sm:px-6">
      <nav aria-label="Fil d'Ariane" className="text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link to={PATHS.catalog} className="hover:text-ink">
              Catalogue
            </Link>
          </li>
          {rootCategory && (
            <li>
              <span aria-hidden="true"> / </span>
              <Link to={catalogPath({ category: rootCategory.id })} className="hover:text-ink">
                {rootCategory.name}
              </Link>
            </li>
          )}
          <li aria-current="page" className="truncate">
            <span aria-hidden="true"> / </span>
            {product.title}
          </li>
        </ol>
      </nav>

      <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-12">
        <Gallery product={product} />

        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-info-soft px-2.5 py-1 text-xs font-medium text-info">
              {isService ? 'Service' : 'Produit'}
            </span>
            {!isService && (
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  product.in_stock ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger'
                }`}
              >
                {product.in_stock ? 'En stock' : 'Rupture'}
              </span>
            )}
          </div>

          <h1 className="text-[26px] font-bold text-ink sm:text-[32px]">{product.title}</h1>

          {supplier.reviews_count > 0 && (
            <p className="flex flex-wrap items-center gap-2 text-[15px] text-muted">
              <StarRating value={supplier.rating_avg} className="text-muted" />
              {formatRating(supplier.rating_avg)} sur 5 - {pluralize(supplier.reviews_count, 'avis', 'avis')} du fournisseur
            </p>
          )}

          <p className="flex flex-wrap items-baseline gap-2">
            <span className="text-[32px] font-bold text-brand-600 sm:text-[36px]">{formatPrice(product.price)}</span>
            <span className="text-[15px] text-muted">
              {product.unit ? `/ ${product.unit} - ` : ''}prix hors taxes
            </span>
          </p>

          <dl className="rounded-xl border border-line bg-surface px-4">
            {!isService && <DetailRow label="Stock disponible" value={formatNumber(product.stock)} />}
            {product.availability_days && (
              <DetailRow label="Délai de disponibilité" value={pluralize(product.availability_days, 'jour')} />
            )}
            {product.unit && <DetailRow label="Unité de vente" value={product.unit} />}
            {category && <DetailRow label="Catégorie" value={category.name} />}
          </dl>

          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface p-4">
            {supplier.logo_url ? (
              <img src={supplier.logo_url} alt="" className="h-12 w-12 rounded-full object-cover" />
            ) : (
              <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-50 font-bold text-brand-600">
                {initialsOf(supplier.company_name)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[17px] font-semibold text-ink">{supplier.company_name}</p>
              <p className="text-xs text-muted">{[supplier.region, 'fournisseur validé'].filter(Boolean).join(' - ')}</p>
            </div>
            <Link to={supplierPublicPath(supplier.id)} className="btn-secondary px-5 py-2.5 font-semibold">
              Voir la fiche
            </Link>
          </div>

          <OrderBox key={product.id} product={product} />
        </div>
      </div>

      <section className="rounded-xl border border-line bg-surface p-5 sm:p-6" aria-labelledby="description-title">
        <h2 id="description-title" className="text-xl font-semibold text-ink">
          Description
        </h2>
        <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-line text-muted">
          {product.description || 'Aucune description.'}
        </p>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5 sm:p-6" aria-labelledby="reviews-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="reviews-title" className="text-xl font-semibold text-ink">
            Avis sur ce fournisseur
          </h2>
          {product.latest_reviews.length > 0 && (
            <Link to={`${supplierPublicPath(supplier.id)}?tab=avis`} className="text-sm font-medium text-brand-600 hover:underline">
              Voir tous les avis
            </Link>
          )}
        </div>
        {product.latest_reviews.length ? (
          <div className="mt-2">
            {product.latest_reviews.map((review) => (
              <ReviewItem key={review.id} review={review} supplierName={supplier.company_name} />
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted">Ce fournisseur n’a pas encore reçu d’avis.</p>
        )}
      </section>

      <SimilarProducts product={product} />
    </div>
  )
}
