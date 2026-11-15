import { Link, useLoaderData } from 'react-router'
import AuthCard from '@/components/AuthCard'
import { selectUser, useAuthStore } from '@/stores/auth'
import { PATHS, loginPath } from '@/router/paths'
import { ROLES, landingPathFor } from '@/utils/roles'

/**
 * Page ouverte par le lien de l'e-mail (/email/verifier?…). Le résultat vient du loader (routes.jsx).
 * Après vérification : porteur → tableau de bord ; fournisseur → « Compte en attente de validation ».
 */
export default function EmailVerifiedView() {
  const result = useLoaderData()
  const currentUser = useAuthStore(selectUser)

  if (result.status === 'verified') {
    const verified = result.user
    const target = landingPathFor(verified)
    const loggedIn = currentUser?.id === verified.id
    const isSupplier = verified.role === ROLES.SUPPLIER

    return (
      <AuthCard icon="✅" title="Adresse e-mail vérifiée">
        <p>Merci {verified.name}, votre adresse e-mail est confirmée.</p>
        {isSupplier ? (
          <p>Votre compte fournisseur doit encore être validé par un administrateur. Vous serez prévenu par e-mail.</p>
        ) : (
          <p>Votre compte est actif : vous pouvez publier vos besoins et recevoir des devis.</p>
        )}
        <Link to={loggedIn ? target : loginPath(target)} className="btn-primary w-full">
          {!loggedIn ? 'Se connecter' : isSupplier ? "Voir l'état de mon compte" : 'Accéder à mon tableau de bord'}
        </Link>
      </AuthCard>
    )
  }

  const continueLink = currentUser ? (
    <Link to={landingPathFor(currentUser)} className="btn-primary w-full">
      Continuer
    </Link>
  ) : (
    <Link to={PATHS.login} className="btn-primary w-full">
      Se connecter
    </Link>
  )

  if (result.status === 'already_verified') {
    return (
      <AuthCard icon="ℹ️" title="Lien déjà utilisé">
        <p>Votre adresse e-mail est déjà vérifiée. Ce lien ne peut servir qu'une seule fois.</p>
        {continueLink}
      </AuthCard>
    )
  }

  // Lien expiré, invalide ou erreur réseau : on propose d'en recevoir un nouveau.
  const title = result.status === 'expired' ? 'Lien expiré' : 'Lien invalide'
  const text =
    result.status === 'expired'
      ? 'Ce lien de vérification a expiré.'
      : result.status === 'invalid'
        ? "Ce lien de vérification n'est pas valide. Vérifiez que vous avez copié l'adresse en entier."
        : result.message

  return (
    <AuthCard icon="⚠️" title={title}>
      <p>{text}</p>
      {currentUser && !currentUser.email_verified ? (
        <Link to={PATHS.verifyNotice} className="btn-primary w-full">
          Recevoir un nouveau lien
        </Link>
      ) : currentUser ? (
        continueLink
      ) : (
        <>
          <p>Connectez-vous pour recevoir un nouveau lien.</p>
          {continueLink}
        </>
      )}
    </AuthCard>
  )
}
