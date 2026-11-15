import { PATHS } from '@/router/paths'

// Mêmes valeurs que l'enum App\Enums\UserRole côté Laravel.
export const ROLES = Object.freeze({
  SUPPLIER: 'supplier',
  BUYER: 'buyer',
  ADMIN: 'admin',
})

export const ROLE_LABELS = Object.freeze({
  [ROLES.SUPPLIER]: 'Fournisseur',
  [ROLES.BUYER]: 'Porteur de projet',
  [ROLES.ADMIN]: 'Administrateur',
})

// Mêmes valeurs que l'enum App\Enums\ValidationStatus côté Laravel.
export const SUPPLIER_STATUS = Object.freeze({
  PENDING: 'en attente',
  VALIDATED: 'validé',
  REJECTED: 'refusé',
})

const HOME_PATHS = {
  [ROLES.SUPPLIER]: PATHS.supplier,
  [ROLES.BUYER]: PATHS.buyer,
  [ROLES.ADMIN]: PATHS.admin,
}

/** Adresse du tableau de bord d'un rôle. */
export function homePathFor(role) {
  return HOME_PATHS[role] ?? PATHS.home
}

/**
 * Page où envoyer un utilisateur connecté (après connexion, après vérification…) :
 * e-mail à vérifier → « Consultez votre boîte mail » ; fournisseur non validé → « Compte en attente » ;
 * sinon → tableau de bord de son rôle.
 */
export function landingPathFor(user) {
  if (!user) return PATHS.home
  if (!user.email_verified) return PATHS.verifyNotice
  if (user.role === ROLES.SUPPLIER && user.supplier_validation_status !== SUPPLIER_STATUS.VALIDATED) {
    return PATHS.supplierPending
  }
  return homePathFor(user.role)
}
