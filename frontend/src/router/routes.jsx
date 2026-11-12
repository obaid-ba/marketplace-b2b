import { redirect } from 'react-router'
import ErrorBoundary from '@/views/errors/ErrorBoundary'
import { ensureAuthLoaded, selectIsAuthenticated, selectRole, useAuthStore } from '@/stores/auth'
import { ROLES } from '@/utils/roles'
import { resolveAccess } from './guard'
import { PATHS } from './paths'

/** Chargement à la demande d'une page (un fichier JS par page). */
const page = (load) => ({ Component: async () => (await load()).default })

/**
 * Contrôle d'accès exécuté avant d'afficher la route (équivalent de router.beforeEach).
 * Voir guard.js pour les règles.
 */
function guard(access) {
  return async ({ request }) => {
    await ensureAuthLoaded()
    const state = useAuthStore.getState()
    const url = new URL(request.url)
    const result = resolveAccess(url.pathname + url.search, access, {
      isAuthenticated: selectIsAuthenticated(state),
      role: selectRole(state),
    })
    if (result !== true) throw redirect(result)
    return null
  }
}

/** Espace réservé à un rôle : contrôle d'accès + mise en page commune + tableau de bord. */
function space(path, role, loadDashboard) {
  return {
    path,
    loader: guard({ roles: [role] }),
    lazy: page(() => import('@/layouts/AppLayout')),
    children: [{ index: true, lazy: page(loadDashboard) }],
  }
}

/**
 * Arbre des routes. Une fonction plutôt qu'une constante : React Router modifie les objets
 * "lazy" une fois chargés, chaque routeur (application, tests) doit donc avoir les siens.
 */
export const createRoutes = () => [
  {
    // Racine : charge l'utilisateur connecté avant le premier affichage.
    loader: async () => {
      await ensureAuthLoaded()
      return null
    },
    HydrateFallback: () => null,
    ErrorBoundary,
    children: [
      // Pages publiques
      { path: PATHS.home, lazy: page(() => import('@/views/HomeView')) },
      { path: PATHS.login, loader: guard({ guest: true }), lazy: page(() => import('@/views/auth/LoginView')) },
      { path: PATHS.register, loader: guard({ guest: true }), lazy: page(() => import('@/views/auth/RegisterView')) },

      // Espaces par rôle
      space(PATHS.supplier, ROLES.SUPPLIER, () => import('@/views/supplier/SupplierDashboard')),
      space(PATHS.buyer, ROLES.BUYER, () => import('@/views/buyer/BuyerDashboard')),
      space(PATHS.admin, ROLES.ADMIN, () => import('@/views/admin/AdminDashboard')),

      // Erreurs
      { path: PATHS.forbidden, lazy: page(() => import('@/views/errors/ForbiddenView')) },
      { path: '*', lazy: page(() => import('@/views/errors/NotFoundView')) },
    ],
  },
]
