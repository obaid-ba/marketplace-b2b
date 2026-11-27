import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import Logo from '@/components/Logo'
import NavIcon from '@/components/NavIcon'
import NotificationBell from '@/components/NotificationBell'
import { isRealtimeConnected, useRealtime } from '@/realtime/realtime'
import { useAuthStore } from '@/stores/auth'
import { useMessagingStore } from '@/stores/messaging'
import { PATHS, catalogPath } from '@/router/paths'
import { initialsOf } from '@/utils/initials'

/**
 * Mise en page commune des espaces connectés (maquettes Figma) : barre latérale + en-tête
 * (fil d'Ariane, recherche, notifications, nom affiché).
 * Utilisée par l'espace fournisseur, l'administration et l'espace porteur de projet.
 *
 * navItems : [{ label, to?, end?, badge?, icon?, group? }] — badge « messages » : nombre de messages non lus (SCRUM-59) ;
 * icon : nom d'une icône de NavIcon ; group : intitulé de la rubrique, affiché au-dessus de sa première entrée.
 * Une entrée sans `to` arrive dans un prochain sprint : elle est affichée, mais inactive (« Bientôt disponible »).
 */
const UNREAD_POLL_INTERVAL = 30_000

function UnreadBadge() {
  const unread = useMessagingStore((state) => state.unread)
  if (unread === 0) return null

  return (
    <span
      aria-label={`${unread} message${unread > 1 ? 's' : ''} non lu${unread > 1 ? 's' : ''}`}
      className="ml-auto grid min-w-5 place-items-center rounded-full bg-brand-600 px-1.5 text-[11px] font-semibold text-white"
    >
      {unread > 99 ? '99+' : unread}
    </span>
  )
}

/** Tient à jour le compteur de messages non lus : temps réel, sinon toutes les 30 secondes. */
function UnreadMessagesWatcher() {
  const refreshUnread = useMessagingStore((state) => state.refreshUnread)

  useRealtime('message.sent', refreshUnread)
  useRealtime('conversation.read', refreshUnread)
  useRealtime('connected', refreshUnread)

  useEffect(() => {
    refreshUnread()
    const timer = setInterval(() => !isRealtimeConnected() && refreshUnread(), UNREAD_POLL_INTERVAL)
    window.addEventListener('focus', refreshUnread)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', refreshUnread)
    }
  }, [refreshUnread])

  return null
}

/** Regroupe les entrées consécutives qui partagent le même `group`. */
function groupItems(navItems) {
  return navItems.reduce((groups, item) => {
    const last = groups.at(-1)
    if (last && last.name === item.group) last.items.push(item)
    else groups.push({ name: item.group, items: [item] })
    return groups
  }, [])
}

const ITEM_CLASS = 'flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] transition'

function Sidebar({ title, homePath, navItems, onNavigate }) {
  const groups = groupItems(navItems)

  return (
    <nav aria-label={title} className="px-4 pt-6 pb-2">
      <Link to={homePath} className="mb-6 flex items-center gap-3 px-2" onClick={onNavigate}>
        <Logo size={36} />
      </Link>

      {groups.map((group, index) => (
        <div key={group.name ?? index} className={index > 0 ? 'mt-4' : ''}>
          <p className="mb-1 px-3 text-[12px] text-muted">{group.name ?? title}</p>
          <ul className="space-y-0.5">
            {group.items.map((item) =>
              item.to ? (
                <li key={item.label}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      `${ITEM_CLASS} ${isActive ? 'bg-brand-50 font-medium text-brand-600' : 'text-ink hover:bg-page'}`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <NavIcon name={item.icon} className={`h-[18px] w-[18px] ${isActive ? '' : 'text-muted'}`} />
                        {item.label}
                        {item.badge === 'messages' && <UnreadBadge />}
                      </>
                    )}
                  </NavLink>
                </li>
              ) : (
                <li key={item.label}>
                  <span aria-disabled="true" title="Bientôt disponible" className={`${ITEM_CLASS} cursor-not-allowed text-ink/50`}>
                    <NavIcon name={item.icon} />
                    {item.label}
                  </span>
                </li>
              ),
            )}
          </ul>
        </div>
      ))}
    </nav>
  )
}

/** Encadré « Besoin d'aide ? » : mène à l'assistant IA de l'espace. */
function HelpCard({ to, onNavigate }) {
  return (
    <div className="rounded-2xl bg-brand-50 px-4 py-4 text-center">
      <svg viewBox="0 0 64 48" className="mx-auto h-12 w-16" aria-hidden="true">
        <path d="M16 16h28l3 26H13z" fill="#6d5fe0" />
        <path d="M22 16v-3a8 8 0 0 1 16 0v3" fill="none" stroke="#4a3bc4" strokeWidth="3" strokeLinecap="round" />
        <path d="M13 42h34l-1-8H14z" fill="#5b4bdb" />
        <circle cx="47" cy="30" r="9" fill="#f472b6" />
        <path d="M43.5 30l2.5 2.5 4.5-5" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M52 8l1.2 3 3 1.2-3 1.2L52 16.4l-1.2-3-3-1.2 3-1.2z" fill="#f58a3d" />
      </svg>
      <p className="mt-2 text-sm font-semibold text-ink">Besoin d&apos;aide ?</p>
      <p className="mt-1 text-xs text-muted">Notre assistant IA est là pour vous !</p>
      <Link
        to={to}
        onClick={onNavigate}
        className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-brand-700"
      >
        Contacter l&apos;assistant
        <NavIcon name="sparkles" className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}

/** Bas de la barre latérale : encadré d'aide (si l'espace a un assistant) puis déconnexion. */
function SidebarFooter({ helpPath, onLogout, onNavigate }) {
  return (
    <div className="mt-auto space-y-4 px-4 pt-4 pb-6">
      {helpPath && <HelpCard to={helpPath} onNavigate={onNavigate} />}
      <button
        type="button"
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[14px] text-danger transition hover:bg-danger-soft"
        onClick={onLogout}
      >
        <NavIcon name="logout" />
        Se déconnecter
      </button>
    </div>
  )
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" strokeLinecap="round" />
    </svg>
  )
}

export default function SpaceLayout({ title, homePath, navItems, displayName, notificationsPath, helpPath }) {
  const logout = useAuthStore((state) => state.logout)
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [search, setSearch] = useState('')

  function handleSearch(event) {
    event.preventDefault()
    navigate(catalogPath({ q: search.trim() }))
  }

  async function handleLogout() {
    await logout()
    navigate(PATHS.login)
  }

  const sidebarProps = { title, homePath, navItems }

  return (
    <div className="min-h-screen bg-page text-ink">
      {navItems.some((item) => item.badge === 'messages') && <UnreadMessagesWatcher />}
      {/* Barre latérale : fixe sur grand écran, tiroir sur mobile */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col overflow-y-auto border-r border-line bg-surface lg:flex">
        <Sidebar {...sidebarProps} />
        <SidebarFooter helpPath={helpPath} onLogout={handleLogout} />
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            className="absolute inset-0 bg-ink/30"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="relative flex h-full w-64 flex-col overflow-y-auto bg-surface shadow-xl">
            <Sidebar {...sidebarProps} onNavigate={() => setMenuOpen(false)} />
            <SidebarFooter helpPath={helpPath} onLogout={handleLogout} onNavigate={() => setMenuOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-10 border-b border-line bg-surface/90 backdrop-blur">
          <div className="flex h-[72px] items-center gap-4 px-4 sm:px-8">
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

            {/* Recherche : ouvre le catalogue filtré (produits et fournisseurs qui les proposent) */}
            <form role="search" onSubmit={handleSearch} className="min-w-0 flex-1">
              <label className="flex h-11 w-full max-w-xl items-center gap-3 rounded-xl border border-line bg-page px-4 text-muted transition focus-within:border-brand-500 focus-within:bg-surface focus-within:ring-2 focus-within:ring-brand-100">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-[18px] w-[18px] shrink-0" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Rechercher un produit, un fournisseur..."
                  aria-label="Rechercher dans le catalogue"
                  className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
                />
              </label>
            </form>

            {/* Centre de notifications : SCRUM-62 */}
            {notificationsPath ? (
              <NotificationBell notificationsPath={notificationsPath} />
            ) : (
              <span
                title="Notifications : bientôt disponibles"
                className="grid h-9 w-9 place-items-center rounded-full bg-page text-muted"
              >
                <BellIcon />
              </span>
            )}

            <Link
              to={PATHS.account}
              title="Paramètres du compte"
              className="flex items-center gap-3 rounded-xl py-1 pr-2 pl-1 transition hover:bg-page"
            >
              <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-50 text-sm font-semibold text-brand-600">
                {initialsOf(displayName)}
              </span>
              <span className="hidden max-w-48 truncate text-[15px] font-medium sm:block">{displayName}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="hidden h-4 w-4 text-muted sm:block" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </Link>
          </div>
        </header>

        <main className="px-4 py-8 sm:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
