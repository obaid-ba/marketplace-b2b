import ErrorPage from '@/components/ErrorPage'

export default function ForbiddenView() {
  return (
    <ErrorPage code="403" title="Accès refusé">
      Cette page n'est pas disponible pour votre type de compte.
    </ErrorPage>
  )
}
