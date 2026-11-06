import { homeRouteFor } from '@/utils/roles'

/**
 * Règles d'accès aux pages, séparées du routeur pour être testées facilement.
 *
 * meta.guest  : page réservée aux visiteurs non connectés (connexion, inscription)
 * meta.roles  : liste des rôles autorisés ; implique d'être connecté
 *
 * @returns true pour laisser passer, ou une redirection { name, query? }
 */
export function resolveAccess(to, auth) {
  const roles = to.meta?.roles

  if (to.meta?.guest && auth.isAuthenticated) {
    return { name: homeRouteFor(auth.role) }
  }

  if (roles?.length) {
    if (!auth.isAuthenticated) {
      return { name: 'login', query: { redirect: to.fullPath } }
    }
    if (!roles.includes(auth.role)) {
      return { name: 'forbidden' }
    }
  }

  return true
}
