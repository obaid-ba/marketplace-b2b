import { isRouteErrorResponse, useRouteError } from 'react-router'
import ErrorPage from '@/components/ErrorPage'

/** Fichier de page impossible à télécharger : connexion coupée ou nouvelle version déployée. */
function isLoadingFailure(error) {
  return /dynamically imported module|Importing a module script failed|Failed to fetch|Loading chunk/i.test(String(error?.message ?? ''))
}

/**
 * Affiché quand une page plante ou ne se charge pas (SCRUM-92) : 404, hors ligne, ou erreur 500.
 */
export default function ErrorBoundary() {
  const error = useRouteError()

  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <ErrorPage code="404" title="Page introuvable">
        L'adresse demandée n'existe pas ou a été déplacée.
      </ErrorPage>
    )
  }

  if (isRouteErrorResponse(error) && error.status === 403) {
    return (
      <ErrorPage code="403" title="Accès refusé">
        Cette page n'est pas disponible pour votre type de compte.
      </ErrorPage>
    )
  }

  if (!navigator.onLine || isLoadingFailure(error)) {
    return (
      <ErrorPage code="Hors ligne" title="Connexion interrompue" retry>
        La page n'a pas pu être chargée. Vérifiez votre connexion Internet puis réessayez : vos saisies en cours sont conservées.
      </ErrorPage>
    )
  }

  if (import.meta.env.DEV) console.error(error)

  return (
    <ErrorPage code="500" title="Une erreur est survenue" retry>
      Un problème inattendu nous empêche d'afficher cette page. Réessayez dans quelques instants ; si le problème persiste,
      revenez à l'accueil.
    </ErrorPage>
  )
}
