import ErrorPage from '@/components/ErrorPage'

export default function NotFoundView() {
  return (
    <ErrorPage code="404" title="Page introuvable">
      L'adresse demandée n'existe pas ou a été déplacée.
    </ErrorPage>
  )
}
