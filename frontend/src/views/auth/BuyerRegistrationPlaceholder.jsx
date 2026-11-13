import { Link } from 'react-router'
import { PATHS } from '@/router/paths'

/**
 * Écran d'attente du parcours porteur de projet.
 * Le formulaire réel arrive au prochain sprint ; la carte « Porteur de projet »
 * de /inscription doit déjà mener quelque part de cohérent (SCRUM-21).
 */
export default function BuyerRegistrationPlaceholder() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-md">
        <Link to={PATHS.registerChoice} className="text-sm text-brand-600">
          ← Changer de type de compte
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">Inscription porteur de projet</h1>
        <p className="mt-2 text-sm text-slate-600">
          Ce parcours arrive bientôt. En attendant, vous pouvez créer un compte fournisseur ou nous
          contacter pour être prévenu de l'ouverture.
        </p>
        <Link to={PATHS.register} className="btn-primary mt-6 inline-block">
          Devenir fournisseur
        </Link>
      </div>
    </div>
  )
}
