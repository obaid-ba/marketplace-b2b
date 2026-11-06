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

const HOME_ROUTES = {
  [ROLES.SUPPLIER]: 'supplier.dashboard',
  [ROLES.BUYER]: 'buyer.dashboard',
  [ROLES.ADMIN]: 'admin.dashboard',
}

/** Nom de la route du tableau de bord affiché après la connexion. */
export function homeRouteFor(role) {
  return HOME_ROUTES[role] ?? 'home'
}
