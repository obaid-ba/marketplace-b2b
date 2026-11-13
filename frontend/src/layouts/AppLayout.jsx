import { Link, Outlet, useNavigate } from 'react-router'
import { selectRole, selectUser, useAuthStore } from '@/stores/auth'
import { PATHS } from '@/router/paths'
import { ROLE_LABELS, landingPathFor } from '@/utils/roles'

export default function AppLayout() {
  const user = useAuthStore(selectUser)
  const role = useAuthStore(selectRole)
  const logout = useAuthStore((state) => state.logout)
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate(PATHS.login)
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link to={landingPathFor(user)} className="text-lg font-semibold text-brand-700">
            Marketplace B2B
          </Link>

          <div className="flex items-center gap-3">
            {/* La cloche de notifications arrive en S5 (SCRUM-62) */}
            <div className="hidden text-right text-sm sm:block">
              <p className="font-medium">{user?.name}</p>
              <p className="text-slate-500">{ROLE_LABELS[role]}</p>
            </div>
            <Link to={PATHS.account} className="btn-ghost">
              Paramètres
            </Link>
            <button type="button" className="btn-ghost" onClick={handleLogout}>
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
