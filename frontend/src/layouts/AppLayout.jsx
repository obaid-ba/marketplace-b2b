import { Link, NavLink, Outlet } from 'react-router'
import LogoutButton from '@/components/LogoutButton'
import { PATHS } from '@/router/paths'
import { selectRole, selectUser, useAuthStore } from '@/stores/auth'
import { ROLES, ROLE_LABELS, landingPathFor } from '@/utils/roles'

export default function AppLayout() {
  const user = useAuthStore(selectUser)
  const role = useAuthStore(selectRole)

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link to={landingPathFor(user)} className="text-lg font-semibold text-brand-700">
              Marketplace B2B
            </Link>

            {role === ROLES.ADMIN && (
              <nav className="flex items-center gap-1">
                <NavLink
                  to={PATHS.admin}
                  end
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                      isActive
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`
                  }
                >
                  Fournisseurs
                </NavLink>
                <NavLink
                  to={PATHS.adminCategories}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                      isActive
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`
                  }
                >
                  Catégories
                </NavLink>
              </nav>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* La cloche de notifications arrive en S5 (SCRUM-62) */}
            <div className="hidden text-right text-sm sm:block">
              <p className="font-medium">{user?.name}</p>
              <p className="text-slate-500">{ROLE_LABELS[role]}</p>
            </div>
            <Link to={PATHS.account} className="btn-ghost">
              Paramètres
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
