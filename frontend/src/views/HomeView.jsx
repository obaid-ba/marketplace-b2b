import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { fetchRegions } from '@/api/catalog'
import { fetchHome } from '@/api/home'
import ProductCard, { ProductCardSkeleton } from '@/components/ProductCard'
import { catalogPath, PATHS } from '@/router/paths'
import { selectIsAuthenticated, useAuthStore } from '@/stores/auth'
import { formatNumber, pluralize } from '@/utils/format'

/**
 * Page d'accueil (SCRUM-38, maquette V1) : recherche, chiffres clés, catégories, produits mis en avant,
 * « Comment ça marche », bandeau fournisseurs. Reste lisible si l'API ne répond pas (contenu statique).
 */

const STEPS = [
  {
    title: 'Publiez votre demande',
    text: 'Décrivez votre besoin, votre budget et votre délai. Les fournisseurs pertinents sont notifiés automatiquement.',
  },
  {
    title: 'Comparez les devis',
    text: 'Recevez plusieurs devis, comparez les prix, délais et conditions, puis échangez par messagerie.',
  },
  {
    title: 'Commandez et suivez',
    text: 'Acceptez le meilleur devis, payez en ligne et suivez chaque étape de la livraison.',
  },
]

function HeroIllustration() {
  return (
    <svg viewBox="0 0 360 300" className="h-auto w-full max-w-[380px]" aria-hidden="true">
      <circle cx="210" cy="160" r="120" fill="#ece8fb" />
      <circle cx="210" cy="160" r="80" fill="#f5e6f0" />
      {/* Cube orange (haut) */}
      <polygon points="210,40 260,65 210,90 160,65" fill="#fbbf8f" />
      <polygon points="160,65 210,90 210,150 160,125" fill="#f58a3d" />
      <polygon points="260,65 210,90 210,150 260,125" fill="#e0742a" />
      {/* Cube violet (bas, centre) */}
      <polygon points="160,125 210,150 210,210 160,185" fill="#6d5fe0" />
      <polygon points="260,125 210,150 210,210 260,185" fill="#5b4bdb" />
      {/* Cube lavande (gauche) */}
      <polygon points="80,150 125,172 80,195 35,172" fill="#cfc8f7" />
      <polygon points="35,172 80,195 80,250 35,228" fill="#a99ef0" />
      <polygon points="125,172 80,195 80,250 125,228" fill="#9387eb" />
      {/* Cube lavande (droite) */}
      <polygon points="300,150 345,172 300,195 255,172" fill="#b9b0f4" />
      <polygon points="255,172 300,195 300,245 255,222" fill="#8f82ea" />
      <polygon points="345,172 300,195 300,245 345,222" fill="#7a6ce4" />
      {/* Carte « validé » */}
      <rect x="10" y="20" width="110" height="52" rx="10" fill="#fff" stroke="#e3e3ee" />
      <circle cx="32" cy="46" r="9" fill="#e3f6ee" />
      <path d="M28 46l3 3 6-6" stroke="#12a06b" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <rect x="48" y="38" width="58" height="6" rx="3" fill="#14142b" />
      <rect x="48" y="50" width="38" height="5" rx="2.5" fill="#c9c9d6" />
      {/* Carte graphique */}
      <rect x="215" y="225" width="125" height="50" rx="10" fill="#fff" stroke="#e3e3ee" />
      <rect x="228" y="255" width="9" height="10" rx="2" fill="#cfc8f7" />
      <rect x="241" y="247" width="9" height="18" rx="2" fill="#9387eb" />
      <rect x="254" y="240" width="9" height="25" rx="2" fill="#5b4bdb" />
      <rect x="267" y="236" width="9" height="29" rx="2" fill="#f58a3d" />
      <rect x="285" y="243" width="42" height="5" rx="2.5" fill="#14142b" />
      <rect x="285" y="254" width="28" height="5" rx="2.5" fill="#c9c9d6" />
    </svg>
  )
}

function Stat({ value, label }) {
  return (
    <div>
      <p className="text-2xl font-bold text-brand-600 sm:text-[28px]">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  )
}

export default function HomeView() {
  const navigate = useNavigate()
  const { hash } = useLocation()
  const isAuthenticated = useAuthStore(selectIsAuthenticated)
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

  return (
    <>
      {/* 1. Hero */}
      <section className="bg-gradient-to-br from-[#f1effd] via-[#f7f3fb] to-[#fff0e6]">
        <div className="mx-auto grid max-w-[1276px] items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:py-20">
          <div>
            <span className="inline-block rounded-full bg-info-soft px-3 py-1 text-xs font-medium text-info">
              Plateforme B2B - Tunisie
            </span>
            <h1 className="mt-5 text-[32px] leading-tight font-bold text-ink sm:text-[44px]">
              Trouvez les bons fournisseurs, sans courir après les devis
            </h1>
            <p className="mt-4 max-w-xl text-[15px] text-muted sm:text-base">
              Publiez votre besoin, comparez les devis reçus et commandez en toute confiance auprès de fournisseurs validés.
            </p>

            <form
              role="search"
              onSubmit={search}
              className="mt-7 flex max-w-2xl flex-col gap-2 rounded-xl border border-line bg-surface p-2 sm:flex-row sm:items-center sm:pl-4"
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
                className="rounded-lg bg-page px-3 py-2 text-sm text-ink"
              >
                <option value="">Toutes les régions</option>
                {regions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn-primary px-5 py-2.5 font-semibold">
                Rechercher
              </button>
            </form>

            {!isAuthenticated && (
              <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
                <span>Nouveau sur la plateforme ?</span>
                <Link to={PATHS.registerChoice} className="font-semibold text-brand-600 hover:underline">
                  S'inscrire
                </Link>
                <span aria-hidden="true">·</span>
                <Link to={PATHS.login} className="font-semibold text-brand-600 hover:underline">
                  Se connecter
                </Link>
              </p>
            )}

            <div className="mt-8 flex flex-wrap gap-x-12 gap-y-4" aria-live="polite">
              <Stat value={stats ? `${formatNumber(stats.suppliers)}` : '—'} label="fournisseurs validés" />
              <Stat value={stats ? formatNumber(stats.products) : '—'} label="produits et services" />
              <Stat value={stats ? formatNumber(stats.regions) : '—'} label="gouvernorats couverts" />
            </div>
          </div>
          <div className="hidden justify-center lg:flex">
            <HeroIllustration />
          </div>
        </div>
      </section>

      {/* 2. Catégories */}
      <section className="mx-auto max-w-[1276px] px-4 py-14 sm:px-6" aria-labelledby="home-categories">
        <h2 id="home-categories" className="text-2xl font-bold text-ink sm:text-[28px]">
          Parcourir par catégorie
        </h2>
        <p className="mt-1 text-sm text-muted">Des milliers de produits et services pour votre activité</p>
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {!loaded
            ? Array.from({ length: 8 }, (_, i) => <li key={i} className="h-28 animate-pulse rounded-xl bg-surface" aria-hidden="true" />)
            : categories.map((category) => (
                <li key={category.id}>
                  <Link
                    to={catalogPath({ category: category.id })}
                    className="block h-full rounded-xl border border-line bg-surface p-4 transition hover:border-brand-100 hover:shadow-sm"
                  >
                    <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-sm font-semibold text-brand-600">
                      {category.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="mt-3 block text-sm font-semibold text-ink">{category.name}</span>
                    <span className="mt-1 block text-xs text-muted">{pluralize(category.products_count ?? 0, 'produit')}</span>
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
      </section>

      {/* 3. Produits mis en avant */}
      {(!loaded || featured.length > 0) && (
        <section className="mx-auto max-w-[1276px] px-4 pb-14 sm:px-6" aria-labelledby="home-featured">
          <h2 id="home-featured" className="text-2xl font-bold text-ink sm:text-[28px]">
            Produits mis en avant
          </h2>
          <p className="mt-1 text-sm text-muted">Sélection des fournisseurs les mieux notés</p>
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
        </section>
      )}

      {/* 4. Comment ça marche */}
      <section id="comment-ca-marche" className="scroll-mt-24 bg-surface" aria-labelledby="home-how">
        <div className="mx-auto max-w-[1276px] px-4 py-14 sm:px-6">
          <h2 id="home-how" className="text-2xl font-bold text-ink sm:text-[28px]">
            Comment ça marche
          </h2>
          <p className="mt-1 text-sm text-muted">Trois étapes pour passer de votre besoin à la livraison</p>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="rounded-xl border border-line bg-surface p-5">
                <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">
                  {index + 1}
                </span>
                <h3 className="mt-4 font-semibold text-ink">{step.title}</h3>
                <p className="mt-2 text-sm text-muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 5. Bandeau fournisseurs */}
      <section className="bg-[#231f55] text-white" aria-labelledby="home-suppliers">
        <div className="mx-auto flex max-w-[1276px] flex-col gap-6 px-4 py-12 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 id="home-suppliers" className="text-2xl font-bold">
              Vous êtes fournisseur ?
            </h2>
            <p className="mt-1 text-sm text-white/80">
              Présentez vos produits et répondez aux appels d'offres des porteurs de projet.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to={PATHS.registerChoice} className="btn bg-surface px-5 py-2.5 font-semibold text-ink hover:bg-page">
              Devenir fournisseur
            </Link>
            {isAuthenticated ? (
              // TODO SCRUM-41 (S3) : lien vers « Publier une demande ».
              <button type="button" className="btn-primary px-5 py-2.5 font-semibold" disabled title="Bientôt disponible">
                Publier une demande
              </button>
            ) : (
              <Link to={PATHS.registerChoice} className="btn-primary px-5 py-2.5 font-semibold">
                Publier une demande
              </Link>
            )}
          </div>
        </div>
      </section>
    </>
  )
}
