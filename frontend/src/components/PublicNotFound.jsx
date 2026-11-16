import { Link } from 'react-router'
import EmptyState from '@/components/EmptyState'
import { PATHS } from '@/router/paths'

/**
 * Page introuvable dans la vitrine publique (produit retiré, fournisseur non visible…).
 */
export default function PublicNotFound({ title, description }) {
  return (
    <div className="mx-auto max-w-[1276px] px-4 py-16 sm:px-6">
      <EmptyState
        icon="?"
        title={title}
        description={description ?? 'Cette page n’existe pas ou n’est plus disponible.'}
        action={
          <Link to={PATHS.catalog} className="btn-primary">
            Parcourir le catalogue
          </Link>
        }
      />
    </div>
  )
}
