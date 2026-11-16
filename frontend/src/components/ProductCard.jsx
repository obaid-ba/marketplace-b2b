import { Link } from 'react-router'
import ProductImagePlaceholder from '@/components/ProductImagePlaceholder'
import { productPath } from '@/router/paths'
import { formatPriceWithUnit, formatRating } from '@/utils/format'

/**
 * Carte produit (maquettes V1 à V4, aperçu F3) : image, titre, fournisseur + région + note, prix.
 * product : réponse ProductCardResource de l'API. linkable=false pour l'aperçu du formulaire.
 */
export default function ProductCard({ product, linkable = true }) {
  const supplier = product.supplier ?? {}
  const supplierLine = [supplier.company_name, supplier.region].filter(Boolean).join(' - ')
  const rating = Number(supplier.rating_avg ?? 0)

  const content = (
    <>
      <div className="aspect-[2/1] overflow-hidden rounded-lg">
        {product.main_image_url ? (
          <img
            src={product.main_image_url}
            alt={product.title}
            loading="lazy"
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
          />
        ) : (
          <ProductImagePlaceholder seed={product.id} className="h-full w-full" />
        )}
      </div>
      <div className="mt-3 min-w-0 space-y-1">
        <h3 className="truncate text-[15px] font-semibold text-ink">{product.title || 'Titre du produit'}</h3>
        <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
          <span className="truncate">{supplierLine}</span>
          {rating > 0 && (
            <span className="shrink-0" aria-label={`Note du fournisseur : ${formatRating(rating)} sur 5`}>
              · ★ {formatRating(rating)}
            </span>
          )}
        </p>
        <p className="text-[17px] font-semibold text-brand-600">{formatPriceWithUnit(product.price, product.unit)}</p>
      </div>
    </>
  )

  const className =
    'group block rounded-xl border border-line bg-surface p-3 transition hover:border-brand-100 hover:shadow-sm'

  return linkable ? (
    <Link to={productPath(product.id)} className={`${className} focus-visible:ring-2 focus-visible:ring-brand-100 focus-visible:outline-none`}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  )
}

/** Squelette de chargement d'une carte produit. */
export function ProductCardSkeleton() {
  return (
    <div className="rounded-xl border border-line bg-surface p-3" aria-hidden="true">
      <div className="aspect-[2/1] animate-pulse rounded-lg bg-page" />
      <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-page" />
      <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-page" />
      <div className="mt-2 h-5 w-1/3 animate-pulse rounded bg-page" />
    </div>
  )
}
