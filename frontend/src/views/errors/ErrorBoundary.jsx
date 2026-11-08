import { isRouteErrorResponse, useRouteError } from 'react-router'
import ErrorPage from '@/components/ErrorPage'

/** Affiché quand une page plante ou ne se charge pas (ex. nouvelle version déployée pendant la navigation). */
export default function ErrorBoundary() {
  const error = useRouteError()

  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <ErrorPage code="404" title="Page introuvable">
        L'adresse demandée n'existe pas ou a été déplacée.
      </ErrorPage>
    )
  }

  if (import.meta.env.DEV) console.error(error)

  return (
    <ErrorPage code="Oups" title="Une erreur est survenue">
      Rechargez la page. Si le problème persiste, réessayez plus tard.
    </ErrorPage>
  )
}
