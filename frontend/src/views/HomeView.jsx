import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { fetchRegions } from '@/api/catalog'
import { fetchHome } from '@/api/home'
import HomeCatalog from '@/components/home/HomeCatalog'
import { categoryIcon, HeroIllustration, LineIcon, ShopIllustration } from '@/components/home/HomeIllustrations'
import ProductCard, { ProductCardSkeleton } from '@/components/ProductCard'
import { catalogPath, PATHS } from '@/router/paths'
import { selectIsAuthenticated, selectUser, useAuthStore } from '@/stores/auth'
import { formatNumber, pluralize } from '@/utils/format'

/**
 * Page d'accueil (SCRUM-38, maquette « landing ») : recherche, chiffres clés, catégories, catalogue avec photos,
 * produits mis en avant, « Comment ça marche », bandeau fournisseurs. Reste lisible si l'API ne répond pas.
 */

const STEPS = [
  {
    title: 'Publiez votre demande',
    text: 'Décrivez votre besoin, votre budget et votre délai. Les fournisseurs pertinents sont notifiés automatiquement.',
    icon: 'edit',
  },
  {
    title: 'Comparez les devis',
    text: 'Recevez plusieurs devis, comparez les prix, délais et conditions, puis échangez par messagerie.',
    icon: 'scale',
  },
  {
    title: 'Commandez et suivez',
    text: 'Acceptez le meilleur devis, payez en ligne et suivez chaque étape de la livraison.',
    icon: 'truck',
  },
]

/** Carte de section : fond blanc translucide, coins très arrondis, ombre violette douce. */
const PANEL = 'rounded-3xl border border-white/70 bg-surface/80 p-6 shadow-[0_10px_40px_-20px_rgba(91,75,219,0.35)] sm:p-8'

/** Atout du hero : icône, chiffre (ou libellé) et légende. */
function Stat({ icon, value, label }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-50 text-brand-600">
        <LineIcon name={icon} className="h-[18px] w-[18px]" />
      </span>
      <span className="leading-tight">
        <span className="block text-lg font-bold text-ink">{value}</span>
        <span className="block text-xs text-muted">{label}</span>
      </span>
    </div>
  )
}

/** Titre de section avec lien « Voir tout ». */
function SectionHeader({ id, title, subtitle, to, linkLabel = 'Voir tout' }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 id={id} className="text-2xl font-bold text-ink sm:text-[28px]">
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
      </div>
      {to && (
        <Link
          to={to}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-brand-100 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-600 transition hover:bg-brand-100 sm:self-auto"
        >
          {linkLabel}
          <LineIcon name="arrow" className="h-4 w-4" />
        </Link>
      )}
    </div>
  )
}

export default function HomeView() {
  const navigate = useNavigate()
  const { hash } = useLocation()
  const isAuthenticated = useAuthStore(selectIsAuthenticated)
  const user = useAuthStore(selectUser)
  const [home, setHome] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [regions, setRegions] = useState([])
  const [query, setQuery] = useState('')
  const [region, setRegion] = useState('')

  useEffect(() => {
    let active = true
    fetchHome()
      .then((data) => active && setHome(data))
      .catch(() => active && setHome(null))
      .finally(() => active && setLoaded(true))
    fetchRegions()
      .then((data) => active && Array.isArray(data) && setRegions(data))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  // Lien « Comment ça marche » (/#comment-ca-marche) : défile jusqu'à la section.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView?.({ behavior: 'smooth' })
  }, [hash, loaded])

  function search(event) {
    event.preventDefault()
    navigate(catalogPath({ q: query.trim(), region }))
  }

  const stats = home?.stats
  const categories = home?.categories ?? []
  const featured = home?.featured_products ?? []
  // Un porteur de projet connecté publie directement ; sinon, il crée d'abord un compte.
  const publishPath = !isAuthenticated ? PATHS.registerChoice : user?.role === 'buyer' ? PATHS.buyerTenderNew : null

  return (
    <div className="bg-linear-to-b from-[#f3f1ff] via-[#f8f6ff] to-page pb-12">
      {/* 1. Hero */}
      <section className="mx-auto max-w-[1276px] px-4 pt-6 sm:px-6 sm:pt-8">
        <div className="relative overflow-hidden rounded-3xl border border-white/70 bg-linear-to-br from-[#f6f4ff] via-[#f1eeff] to-[#ebe6ff] shadow-[0_10px_40px_-20px_rgba(91,75,219,0.35)]">
          <div aria-hidden="true" className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/50" />
          <div className="relative grid items-center gap-8 px-6 py-10 sm:px-10 lg:grid-cols-[minmax(0,1fr)_420px] lg:py-12">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-100 bg-surface/80 px-3 py-1 text-xs font-semibold text-brand-600">
                <LineIcon name="pin" className="h-3.5 w-3.5" />
                Plateforme B2B - Tunisie
              </span>
              <h1 className="mt-5 text-[32px] leading-[1.15] font-bold tracking-tight text-ink sm:text-[44px]">
                Trouvez les bons fournisseurs, sans{' '}
                <span className="relative inline-block">
                  courir
                  <svg viewBox="0 0 120 12" preserveAspectRatio="none" className="absolute -bottom-2 left-0 h-3 w-full" aria-hidden="true">
                    <path d="M2 9C30 3 80 2 118 6" fill="none" stroke="#5b4bdb" strokeWidth="4" strokeLinecap="round" />
                  </svg>
                </span>{' '}
                après les devis
              </h1>
              <p className="mt-5 max-w-xl text-[15px] text-muted sm:text-base">
                Publiez votre besoin, comparez les devis reçus et commandez en toute confiance auprès de fournisseurs validés.
              </p>

              <form
                role="search"
                onSubmit={search}
                className="mt-7 flex max-w-2xl flex-col gap-2 rounded-2xl border border-line bg-surface p-2 shadow-sm sm:flex-row sm:items-center sm:pl-4"
              >
                <label htmlFor="home-search" className="sr-only">
                  Que cherchez-vous ?
                </label>
                <input
                  id="home-search"
                  type="search"
                  value={query}
                  maxLength={100}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Que cherchez-vous ? Ex : emballages, pièces, maintenance"
                  className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted sm:px-0"
                />
                <label htmlFor="home-region" className="sr-only">
                  Région
                </label>
                <select
                  id="home-region"
                  value={region}
                  onChange={(event) => setRegion(event.target.value)}
                  className="rounded-xl border border-line bg-page px-3 py-2.5 text-sm font-medium text-ink"
                >
                  <option value="">Toutes les régions</option>
                  {regions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <button type="submit" className="btn-primary gap-2 rounded-xl px-5 py-2.5 font-semibold shadow-sm">
                  <LineIcon name="search" className="h-4 w-4" />
                  Rechercher
                </button>
              </form>

              {!isAuthenticated && (
                <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
                  <span>Nouveau sur la plateforme ?</span>
                  <Link to={PATHS.registerChoice} className="font-semibold text-brand-600 hover:underline">
                    S'inscrire
                  </Link>
                  <Link to={PATHS.login} className="font-semibold text-brand-600 hover:underline">
                    Se connecter
                  </Link>
                </p>
              )}

              <div className="mt-8 flex flex-wrap gap-x-8 gap-y-4 sm:divide-x sm:divide-brand-100" aria-live="polite">
                <Stat icon="shield" value={stats ? formatNumber(stats.suppliers) : '—'} label="fournisseurs validés" />
                <div className="sm:pl-8">
                  <Stat icon="bolt" value={stats ? formatNumber(stats.products) : '—'} label="produits et services" />
                </div>
                <div className="sm:pl-8">
                  <Stat icon="handshake" value={stats ? formatNumber(stats.regions) : '—'} label="gouvernorats couverts" />
                </div>
              </div>
            </div>
            <div className="hidden justify-center lg:flex">
              <HeroIllustration />
            </div>
          </div>
        </div>
      </section>

      {/* 2. Catégories */}
      <section className="mx-auto max-w-[1276px] px-4 pt-6 sm:px-6" aria-labelledby="home-categories">
        <div className={PANEL}>
          <SectionHeader
            id="home-categories"
            title="Parcourir par catégorie"
            subtitle="Des milliers de produits et services pour votre activité"
            to={PATHS.catalog}
          />
          <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {!loaded
              ? Array.from({ length: 8 }, (_, i) => <li key={i} className="h-24 animate-pulse rounded-2xl bg-page" aria-hidden="true" />)
              : categories.map((category) => (
                  <li key={category.id} className="min-w-0">
                    {/* Téléphone : l'icône passe au-dessus du nom, pour que les noms longs tiennent sur deux colonnes. */}
                    <Link
                      to={catalogPath({ category: category.id })}
                      className="group flex h-full flex-col items-start gap-2 rounded-2xl border border-line bg-surface p-3 transition hover:-translate-y-0.5 hover:border-brand-100 hover:shadow-md sm:flex-row sm:items-center sm:gap-3 sm:p-4"
                    >
                      <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white sm:h-12 sm:w-12">
                        <LineIcon name={categoryIcon(category.name)} className="h-6 w-6" />
                      </span>
                      <span className="min-w-0 max-w-full">
                        <span className="block text-sm font-semibold break-words hyphens-auto text-ink">{category.name}</span>
                        <span className="mt-0.5 block text-xs text-muted">{pluralize(category.products_count ?? 0, 'produit')}</span>
                      </span>
                    </Link>
                  </li>
                ))}
          </ul>
          {loaded && categories.length === 0 && (
            <p className="mt-6 text-sm text-muted">
              Les catégories n’ont pas pu être chargées.{' '}
              <Link to={PATHS.catalog} className="font-medium text-brand-600 hover:underline">
                Ouvrir le catalogue
              </Link>
            </p>
          )}
        </div>
      </section>

      {/* 3. Catalogue des produits (photos réelles) */}
      <div className="pt-6">
        <HomeCatalog categories={categories} />
      </div>

      {/* 4. Produits mis en avant */}
      {(!loaded || featured.length > 0) && (
        <section className="mx-auto max-w-[1276px] px-4 pt-6 sm:px-6" aria-labelledby="home-featured">
          <div className={PANEL}>
            <SectionHeader
              id="home-featured"
              title="Produits mis en avant"
              subtitle="Sélection des fournisseurs les mieux notés"
              to={PATHS.suppliers}
              linkLabel="Voir les fournisseurs"
            />
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {!loaded
                ? Array.from({ length: 4 }, (_, i) => (
                    <li key={i}>
                      <ProductCardSkeleton />
                    </li>
                  ))
                : featured.map((product) => (
                    <li key={product.id}>
                      <ProductCard product={product} />
                    </li>
                  ))}
            </ul>
          </div>
        </section>
      )}

      {/* 5. Comment ça marche */}
      <section id="comment-ca-marche" className="mx-auto max-w-[1276px] scroll-mt-24 px-4 pt-6 sm:px-6" aria-labelledby="home-how">
        <div className={PANEL}>
          <SectionHeader id="home-how" title="Comment ça marche" subtitle="Trois étapes pour passer de votre besoin à la livraison" />
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-4 rounded-2xl border border-line bg-surface p-5 transition hover:border-brand-100 hover:shadow-md">
                <span aria-hidden="true" className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-600">
                  <LineIcon name={step.icon} className="h-8 w-8" />
                </span>
                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 font-semibold text-ink">
                    <span aria-hidden="true" className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white">
                      {index + 1}
                    </span>
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm text-muted">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 6. Bandeau fournisseurs */}
      <section className="mx-auto max-w-[1276px] px-4 pt-6 sm:px-6" aria-labelledby="home-suppliers">
        <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-[#3b2bb5] via-[#4a3bc4] to-[#6d5fe0] px-6 py-8 text-white shadow-[0_10px_40px_-15px_rgba(74,59,196,0.6)] sm:px-10">
          <div aria-hidden="true" className="absolute -top-16 -right-10 h-56 w-56 rounded-full bg-white/10" />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-6">
              <div className="hidden sm:block">
                <ShopIllustration />
              </div>
              <div>
                <h2 id="home-suppliers" className="text-2xl font-bold">
                  Vous êtes fournisseur ?
                </h2>
                <p className="mt-1 text-sm text-white/80">
                  Référencez vos produits et répondez aux appels d'offres des porteurs de projet.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to={PATHS.registerChoice} className="btn gap-2 rounded-xl bg-surface px-5 py-2.5 font-semibold text-ink hover:bg-page">
                Devenir fournisseur
                <LineIcon name="arrow" className="h-4 w-4" />
              </Link>
              {publishPath ? (
                <Link to={publishPath} className="btn gap-2 rounded-xl border border-white/30 bg-white/15 px-5 py-2.5 font-semibold text-white hover:bg-white/25">
                  Publier une demande
                  <LineIcon name="arrow" className="h-4 w-4" />
                </Link>
              ) : (
                <button
                  type="button"
                  className="btn rounded-xl border border-white/30 bg-white/15 px-5 py-2.5 font-semibold text-white"
                  disabled
                  title="Réservé aux porteurs de projet"
                >
                  Publier une demande
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
