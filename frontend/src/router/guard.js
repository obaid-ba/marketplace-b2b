import { homePathFor } from '@/utils/roles'
import { PATHS, loginPath } from './paths'

/**
 * Règles d'accès aux pages, séparées du routeur pour être testées facilement.
 *
 * access.guest : page réservée aux visiteurs non connectés (connexion, inscription)
 * access.roles : liste des rôles autorisés ; implique d'être connecté
 *
 * @param {string} fullPath  adresse demandée (chemin + paramètres)
 * @param {{ guest?: boolean, roles?: string[] }} access
 * @param {{ isAuthenticated: boolean, role: string | null }} auth
 * @returns true pour laisser passer, ou l'adresse vers laquelle rediriger
 */
export function resolveAccess(fullPath, access, auth) {
  const roles = access?.roles

  if (access?.guest && auth.isAuthenticated) {
    return homePathFor(auth.role)
  }

  if (roles?.length) {
    if (!auth.isAuthenticated) {
      return loginPath(fullPath)
    }
    if (!roles.includes(auth.role)) {
      return PATHS.forbidden
    }
  }

  return true
}
