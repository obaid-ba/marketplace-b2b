import { ROLES, SUPPLIER_STATUS, landingPathFor } from '@/utils/roles'
import { PATHS, loginPath } from './paths'

/**
 * Règles d'accès aux pages, séparées du routeur pour être testées facilement.
 *
 * access.guest           : page réservée aux visiteurs non connectés (connexion, inscription)
 * access.unverified      : page réservée à un utilisateur connecté dont l'e-mail reste à vérifier
 * access.roles           : liste des rôles autorisés ; implique d'être connecté avec un e-mail vérifié
 * access.supplierPending : page « Compte en attente de validation » (fournisseur pas encore validé)
 *
 * @param {string} fullPath  adresse demandée (chemin + paramètres)
 * @param {{ guest?: boolean, unverified?: boolean, roles?: string[], supplierPending?: boolean }} access
 * @param {object | null} user  utilisateur connecté (réponse de /auth/me) ou null
 * @returns true pour laisser passer, ou l'adresse vers laquelle rediriger
 */
export function resolveAccess(fullPath, access, user) {
  if (access?.guest) {
    return user ? landingPathFor(user) : true
  }

  if (access?.unverified) {
    if (!user) return loginPath(fullPath)
    return user.email_verified ? landingPathFor(user) : true
  }

  const roles = access?.roles
  if (roles?.length) {
    if (!user) return loginPath(fullPath)
    if (!user.email_verified) return PATHS.verifyNotice
    if (!roles.includes(user.role)) return PATHS.forbidden

    // Un fournisseur non validé n'a accès qu'à la page « Compte en attente », et inversement.
    // Contrôle fait seulement sur les pages qui le demandent (pas sur la route parente de l'espace).
    if (user.role === ROLES.SUPPLIER && typeof access.supplierPending === 'boolean') {
      const validated = user.supplier_validation_status === SUPPLIER_STATUS.VALIDATED
      if (access.supplierPending && validated) return PATHS.supplier
      if (!access.supplierPending && !validated) return PATHS.supplierPending
    }
  }

  return true
}
