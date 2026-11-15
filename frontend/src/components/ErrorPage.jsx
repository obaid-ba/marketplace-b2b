import { Link } from 'react-router'
import { PATHS } from '@/router/paths'
import { selectIsAuthenticated, useAuthStore } from '@/stores/auth'
import LogoutButton from './LogoutButton'

/** Page d'erreur plein écran (403, 404…). */
export default function ErrorPage({ code, title, children }) {
  const isAuthenticated = useAuthStore(selectIsAuthenticated)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="text-6xl font-bold text-slate-300">{code}</p>
      <h1 className="mt-4 text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-slate-600">{children}</p>
      <div className="mt-6 flex items-center gap-2">
        <Link to={PATHS.home} className="btn-primary">
          Retour à l'accueil
        </Link>
        {isAuthenticated && <LogoutButton />}
      </div>
    </div>
  )
}
