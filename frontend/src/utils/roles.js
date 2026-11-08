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

const HOME_PATHS = {
  [ROLES.SUPPLIER]: PATHS.supplier,
  [ROLES.BUYER]: PATHS.buyer,
  [ROLES.ADMIN]: PATHS.admin,
}

/** Adresse du tableau de bord affiché après la connexion. */
export function homePathFor(role) {
  return HOME_PATHS[role] ?? PATHS.home
}
