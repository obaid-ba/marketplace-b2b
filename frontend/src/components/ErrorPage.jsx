import { Link } from 'react-router'
import { PATHS } from '@/router/paths'
import { selectIsAuthenticated, useAuthStore } from '@/stores/auth'
import LogoutButton from './LogoutButton'

/**
 * Page d'erreur plein écran (403, 404, 500, hors ligne — SCRUM-92) : code, explication et liens de retour.
 * retry : affiche « Réessayer » (recharge la page).
 */
export default function ErrorPage({ code, title, children, retry = false }) {
  const isAuthenticated = useAuthStore(selectIsAuthenticated)

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-page px-4 text-center">
      <p className="text-6xl font-bold text-brand-100" aria-hidden="true">
        {code}
      </p>
      <h1 className="mt-4 text-2xl font-semibold text-ink">{title}</h1>
      <p className="mt-2 max-w-md text-muted">{children}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {retry && (
          <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
            Réessayer
          </button>
        )}
        <Link to={PATHS.home} className={retry ? 'btn-secondary' : 'btn-primary'}>
          Retour à l'accueil
        </Link>
        {typeof window !== 'undefined' && window.history.length > 1 && (
          <button type="button" className="btn-ghost" onClick={() => window.history.back()}>
            Page précédente
          </button>
        )}
        {isAuthenticated && <LogoutButton />}
      </div>
    </main>
  )
}
