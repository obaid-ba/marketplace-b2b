import { Link } from 'react-router'
import { selectIsAuthenticated, selectRole, useAuthStore } from '@/stores/auth'
import { PATHS } from '@/router/paths'
import { homePathFor } from '@/utils/roles'

export default function HomeView() {
  const isAuthenticated = useAuthStore(selectIsAuthenticated)
  const role = useAuthStore(selectRole)

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <span className="text-lg font-semibold text-brand-700">Marketplace B2B</span>
        {isAuthenticated ? (
          <Link to={homePathFor(role)} className="btn-primary">
            Mon espace
          </Link>
        ) : (
          <Link to={PATHS.login} className="btn-primary">
            Se connecter
          </Link>
        )}
      </header>

      {/* Page d'accueil complète (recherche, catégories, produits mis en avant) : S2, SCRUM-38 */}
      <section className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight">Achetez et vendez entre professionnels</h1>
        <p className="mt-4 text-lg text-slate-600">
          Publiez un besoin, recevez des devis de fournisseurs tunisiens et suivez vos commandes jusqu'à la facture.
        </p>
      </section>
    </div>
  )
}
