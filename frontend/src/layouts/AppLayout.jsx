import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router'
import LogoutButton from '@/components/LogoutButton'
import { PATHS } from '@/router/paths'
import { selectRole, selectUser, useAuthStore } from '@/stores/auth'
import { ROLES, ROLE_LABELS, landingPathFor } from '@/utils/roles'

const ADMIN_LINKS = [
  { label: 'Fournisseurs', to: PATHS.adminSuppliers },
  { label: 'Catégories', to: PATHS.adminCategories },
]

const adminLinkClass = ({ isActive }) =>
  `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
  }`

/** Liens du compte : sur une ligne dans l'en-tête, ou empilés dans le menu du téléphone. */
function AccountLinks({ role, className, onNavigate }) {
  return (
    <>
      {role === ROLES.BUYER && (
        <Link to={PATHS.buyerOrders} className={className} onClick={onNavigate}>
          Mes commandes
        </Link>
      )}
      <Link to={PATHS.account} className={className} onClick={onNavigate}>
        Paramètres
      </Link>
      <LogoutButton className={className} />
    </>
  )
}

export default function AppLayout() {
  const user = useAuthStore(selectUser)
  const role = useAuthStore(selectRole)
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  const adminLinks = role === ROLES.ADMIN ? ADMIN_LINKS : []

  const identity = (
    <>
      <p className="truncate font-medium">{user?.name}</p>
      <p className="text-slate-500">{ROLE_LABELS[role]}</p>
    </>
  )

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link to={landingPathFor(user)} className="text-lg font-semibold whitespace-nowrap text-brand-700">
              Marketplace B2B
            </Link>
            {adminLinks.length > 0 && (
              <nav aria-label="Administration" className="hidden items-center gap-1 md:flex">
                {adminLinks.map((link) => (
                  <NavLink key={link.to} to={link.to} className={adminLinkClass}>
                    {link.label}
                  </NavLink>
                ))}
              </nav>
            )}
          </div>

          <div className="hidden min-w-0 items-center gap-3 md:flex">
            <div className="min-w-0 text-right text-sm">{identity}</div>
            <AccountLinks role={role} className="btn-ghost shrink-0" />
          </div>

          <button
            type="button"
            className="btn-ghost -mr-2 px-2 md:hidden"
            aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={open}
            aria-controls="account-mobile-menu"
            onClick={() => setOpen((value) => !value)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6" aria-hidden="true">
              {open ? <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /> : <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />}
            </svg>
          </button>
        </div>

        {open && (
          <nav id="account-mobile-menu" aria-label="Menu du compte" className="flex flex-col border-t border-slate-200 px-4 py-3 md:hidden">
            <div className="px-4 pb-2 text-sm">{identity}</div>
            {adminLinks.map((link) => (
              <Link key={link.to} to={link.to} className="btn-ghost justify-start" onClick={close}>
                {link.label}
              </Link>
            ))}
            <AccountLinks role={role} className="btn-ghost justify-start" onNavigate={close} />
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
