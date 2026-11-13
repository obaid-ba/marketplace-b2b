import { Link } from 'react-router'
import { selectUser, useAuthStore } from '@/stores/auth'
import { PATHS } from '@/router/paths'
import { SUPPLIER_STATUS } from '@/utils/roles'

/**
 * « Compte en attente de validation » : un fournisseur arrive ici après avoir vérifié son e-mail,
 * tant qu'un administrateur n'a pas validé ses justificatifs (validation : SCRUM-31).
 */
export default function SupplierPendingView() {
  const user = useAuthStore(selectUser)
  const rejected = user?.supplier_validation_status === SUPPLIER_STATUS.REJECTED

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">
        {rejected ? 'Compte fournisseur refusé' : 'Compte en attente de validation'}
      </h1>

      <div className="card mt-6 space-y-3 text-slate-600">
        {rejected ? (
          <p>
            Après vérification de vos justificatifs, votre compte n'a pas été validé. Le motif vous a été envoyé par
            e-mail. Vous pouvez contacter l'équipe pour régulariser votre dossier.
          </p>
        ) : (
          <>
            <p>
              <span className="font-medium text-slate-900">Votre adresse e-mail est confirmée.</span> Un administrateur
              vérifie maintenant votre registre de commerce et vos certifications.
            </p>
            <p>
              Vous recevrez un e-mail dès que votre compte sera validé. Vous pourrez alors publier vos produits et
              répondre aux demandes des porteurs de projet.
            </p>
          </>
        )}
      </div>

      <Link to={PATHS.account} className="btn-ghost mt-4 border border-slate-300">
        Modifier mes informations personnelles
      </Link>
    </div>
  )
}
