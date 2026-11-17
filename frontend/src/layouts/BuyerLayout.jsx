import { useState } from 'react'
import { Link, NavLink, Outlet, useMatches, useNavigate } from 'react-router'
import NotificationBell from '@/components/NotificationBell'
import { PATHS } from '@/router/paths'
import { selectUser, useAuthStore } from '@/stores/auth'
import { initialsOf } from '@/utils/initials'

/**
 * Mise en page « Espace porteur de projet » : barre latérale + en-tête
 * (fil d'Ariane, notifications, compte connecté), sur le modèle de l'espace fournisseur.
 */
const NAV_ITEMS = [
  { label: 'Tableau de bord', to: PATHS.buyer, end: true },
  { label: 'Mes demandes', to: PATHS.buyerTenders, end: true }, // SCRUM-43
  { label: 'Publier une demande', to: PATHS.buyerTenderNew }, // SCRUM-41
  { label: 'Mes commandes', to: PATHS.buyerOrders }, // SCRUM-48
  { label: 'Notifications', to: PATHS.buyerNotifications }, // SCRUM-62
  { label: 'Préférences de notification', to: PATHS.notificationPreferences }, // SCRUM-63
  { label: 'Paramètres du compte', to: PATHS.account }, // SCRUM-27
]

function Dot({ active }) {
  return (
    <span
      aria-hidden="true"
      className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? 'bg-brand-600' : 'bg-line'}`}
    />
  )
}

function Sidebar({ onNavigate }) {
  return (
    <nav aria-label="Espace porteur de projet" className="px-4 py-6">
      <Link to={PATHS.buyer} className="mb-8 flex items-center gap-3 px-2" onClick={onNavigate}>
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-base font-bold text-white">M</span>
        <span className="text-[17px] font-semibold text-ink">Marketplace B2B</span>
      </Link>

      <p className="mb-3 px-3 text-[11px] font-medium tracking-wide text-muted uppercase">Espace porteur</p>

      <ul className="space-y-1">
        {NAV_ITEMS.map((item) => (
          <li key={item.label}>
            <NavLink
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition ${
                  isActive ? 'bg-brand-50 font-medium text-brand-600' : 'text-ink hover:bg-page'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Dot active={isActive} />
                  {item.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default function BuyerLayout() {
  const user = useAuthStore(selectUser)
  const logout = useAuthStore((state) => state.logout)
  const navigate = useNavigate()
  const matches = useMatches()
  const [menuOpen, setMenuOpen] = useState(false)

  const crumb = [...matches].reverse().find((match) => match.handle?.crumb)?.handle.crumb
  const displayName = user?.buyer_organization || user?.name

  async function handleLogout() {
    await logout()
    navigate(PATHS.login)
  }

  return (
    <div className="min-h-screen bg-page text-ink">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-line bg-surface lg:flex">
        <Sidebar />
        <div className="mt-auto px-4 pb-6">
          <button type="button" className="btn-ghost w-full justify-start" onClick={handleLogout}>
            Déconnexion
          </button>
        </div>
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            className="absolute inset-0 bg-ink/30"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="relative flex h-full w-64 flex-col bg-surface shadow-xl">
            <Sidebar onNavigate={() => setMenuOpen(false)} />
            <div className="mt-auto px-4 pb-6">
              <button type="button" className="btn-ghost w-full justify-start" onClick={handleLogout}>
                Déconnexion
              </button>
            </div>
          </aside>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-10 border-b border-line bg-surface">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-8">
            <button
              type="button"
              className="btn-ghost -ml-2 px-2 lg:hidden"
              aria-label="Ouvrir le menu"
              onClick={() => setMenuOpen(true)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
              </svg>
            </button>

            <nav aria-label="Fil d'Ariane" className="min-w-0 flex-1 truncate text-sm text-muted">
              <Link to={PATHS.buyer} className="hover:text-ink">
                Espace porteur
              </Link>
              {crumb && crumb !== 'Tableau de bord' && (
                <>
                  <span className="mx-2" aria-hidden="true">/</span>
                  <span aria-current="page">{crumb}</span>
                </>
              )}
            </nav>

            <NotificationBell notificationsPath={PATHS.buyerNotifications} />

            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-50 text-sm font-semibold text-brand-600">
                {initialsOf(displayName)}
              </span>
              <span className="hidden max-w-48 truncate text-[15px] font-medium sm:block">{displayName}</span>
            </div>
          </div>
        </header>

        <main className="px-4 py-8 sm:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
