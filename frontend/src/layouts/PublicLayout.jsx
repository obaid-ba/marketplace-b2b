import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { selectIsAuthenticated, selectUser, useAuthStore } from '@/stores/auth'
import { PATHS } from '@/router/paths'
import { initialsOf } from '@/utils/initials'
import { landingPathFor } from '@/utils/roles'

/**
 * Mise en page des pages publiques (maquettes V1 à V4) : en-tête + pied de page sombre.
 * Accessible sans connexion ; un utilisateur connecté voit son avatar et un lien vers son espace.
 */

function Logo({ inverted = false }) {
  return (
    <span className="flex items-center gap-2.5">
      <span
        className={`grid h-8 w-8 place-items-center rounded-lg text-base font-bold ${
          inverted ? 'bg-surface text-brand-600' : 'bg-brand-600 text-white'
        }`}
      >
        M
      </span>
      <span className={`text-[17px] font-bold ${inverted ? 'text-white' : 'text-ink'}`}>Marketplace B2B</span>
    </span>
  )
}

const linkClass = ({ isActive }) =>
  `text-[15px] font-medium transition ${isActive ? 'text-brand-600' : 'text-ink hover:text-brand-600'}`

function NavLinks({ onNavigate, vertical = false }) {
  const { pathname, hash } = useLocation()
  const howItWorksActive = pathname === PATHS.home && hash === '#comment-ca-marche'

  return (
    <ul className={vertical ? 'flex flex-col gap-1' : 'flex items-center gap-8'}>
      <li>
        <NavLink
          to={PATHS.home}
          end
          onClick={onNavigate}
          className={(state) => `${linkClass({ isActive: state.isActive && !howItWorksActive })} ${vertical ? 'block rounded-lg px-3 py-2.5 hover:bg-page' : ''}`}
        >
          Accueil
        </NavLink>
      </li>
      <li>
        <NavLink
          to={PATHS.catalog}
          onClick={onNavigate}
          className={(state) => `${linkClass(state)} ${vertical ? 'block rounded-lg px-3 py-2.5 hover:bg-page' : ''}`}
        >
          Catalogue
        </NavLink>
      </li>
      <li>
        {/* Annuaire des fournisseurs : pas de story dans ce sprint. */}
        <span
          title="Bientôt disponible"
          aria-disabled="true"
          className={`cursor-not-allowed text-[15px] font-medium text-ink/50 ${vertical ? 'block px-3 py-2.5' : ''}`}
        >
          Fournisseurs
        </span>
      </li>
      <li>
        <Link
          to={PATHS.howItWorks}
          onClick={onNavigate}
          className={`${linkClass({ isActive: howItWorksActive })} ${vertical ? 'block rounded-lg px-3 py-2.5 hover:bg-page' : ''}`}
        >
          Comment ça marche
        </Link>
      </li>
    </ul>
  )
}

function AccountActions({ onNavigate, stacked = false }) {
  const isAuthenticated = useAuthStore(selectIsAuthenticated)
  const user = useAuthStore(selectUser)

  if (isAuthenticated) {
    const name = user?.supplier_company_name || user?.name
    return (
      <Link
        to={landingPathFor(user)}
        onClick={onNavigate}
        className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-page"
        aria-label={`Mon espace (${name})`}
      >
        <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-50 text-sm font-semibold text-brand-600">
          {initialsOf(name)}
        </span>
        <span className="text-[15px] font-medium text-ink">Mon espace</span>
      </Link>
    )
  }

  return (
    <div className={stacked ? 'flex flex-col gap-2' : 'flex items-center gap-3'}>
      <Link to={PATHS.login} onClick={onNavigate} className="btn-secondary px-5 py-2.5 font-semibold">
        Connexion
      </Link>
      <Link to={PATHS.registerChoice} onClick={onNavigate} className="btn-primary px-5 py-2.5 font-semibold">
        Créer un compte
      </Link>
    </div>
  )
}

export function PublicHeader() {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface">
      <div className="mx-auto flex h-[72px] max-w-[1276px] items-center justify-between gap-6 px-4 sm:px-6">
        <Link to={PATHS.home} aria-label="Marketplace B2B — accueil">
          <Logo />
        </Link>

        <nav aria-label="Navigation principale" className="hidden lg:block">
          <NavLinks />
        </nav>

        <div className="hidden lg:block">
          <AccountActions />
        </div>

        <button
          type="button"
          className="btn-ghost -mr-2 px-2 lg:hidden"
          aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={open}
          aria-controls="public-mobile-menu"
          onClick={() => setOpen((value) => !value)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6" aria-hidden="true">
            {open ? <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /> : <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />}
          </svg>
        </button>
      </div>

      {open && (
        <div id="public-mobile-menu" className="border-t border-line bg-surface px-4 pt-3 pb-5 lg:hidden">
          <nav aria-label="Navigation principale (mobile)">
            <NavLinks vertical onNavigate={close} />
          </nav>
          <div className="mt-4 border-t border-line pt-4">
            <AccountActions stacked onNavigate={close} />
          </div>
        </div>
      )}
    </header>
  )
}

export function PublicFooter() {
  return (
    <footer className="bg-ink text-white">
      <div className="mx-auto flex max-w-[1276px] flex-col gap-6 px-4 py-10 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <Link to={PATHS.home} aria-label="Marketplace B2B — accueil">
          <Logo inverted />
        </Link>
        <nav aria-label="Liens du pied de page">
          <ul className="flex flex-wrap gap-x-8 gap-y-2 text-sm text-white/85">
            <li>
              <Link to={PATHS.catalog} className="hover:text-white">
                Catalogue
              </Link>
            </li>
            <li>
              <span className="cursor-not-allowed text-white/50" title="Bientôt disponible">
                Fournisseurs
              </span>
            </li>
            <li>
              <span className="cursor-not-allowed text-white/50" title="Bientôt disponible">
                Conditions d'utilisation
              </span>
            </li>
            <li>
              <span className="cursor-not-allowed text-white/50" title="Bientôt disponible">
                Contact
              </span>
            </li>
          </ul>
        </nav>
        <p className="text-xs text-white/70">© 2026 Marketplace B2B - ISET Djerba</p>
      </div>
    </footer>
  )
}

export default function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-page text-ink">
      <PublicHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  )
}
