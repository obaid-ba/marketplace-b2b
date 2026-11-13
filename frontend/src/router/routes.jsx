import { redirect } from 'react-router'
import ErrorBoundary from '@/views/errors/ErrorBoundary'
import { verifyEmail } from '@/api/emailVerification'
import { ensureAuthLoaded, selectIsAuthenticated, useAuthStore } from '@/stores/auth'
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
    const user = selectIsAuthenticated(state) ? state.user : null
    const result = resolveAccess(url.pathname + url.search, access, user)
    if (result !== true) throw redirect(result)
    return null
  }
}

/** Espace réservé à un rôle : contrôle d'accès + mise en page commune + tableau de bord (+ autres pages). */
function space(path, role, loadDashboard, children = []) {
  return {
    path,
    loader: guard({ roles: [role] }),
    lazy: page(() => import('@/layouts/AppLayout')),
    children: [
      // Fournisseur : tableau de bord seulement une fois validé par l'admin (voir guard.js).
      { index: true, loader: role === ROLES.SUPPLIER ? supplierOnly(false) : undefined, lazy: page(loadDashboard) },
      ...children,
    ],
  }
}

/**
 * Page ouverte par le lien de l'e-mail : la vérification se fait dans le loader
 * (exécuté une seule fois par navigation, contrairement à un useEffect en mode strict).
 */
async function verifyEmailLoader({ request }) {
  await ensureAuthLoaded()
  const result = await verifyEmail(new URL(request.url).searchParams)
  const { user, setUser } = useAuthStore.getState()
  if (result.status === 'verified' && user?.id === result.user.id) {
    setUser(result.user)
  }
  return result
}

const supplierOnly = (supplierPending) => guard({ roles: [ROLES.SUPPLIER], supplierPending })

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

      // Mot de passe oublié (SCRUM-26). La page du lien reste ouverte à tous : on peut la recevoir déjà connecté.
      {
        path: PATHS.forgotPassword,
        loader: guard({ guest: true }),
        lazy: page(() => import('@/views/auth/ForgotPasswordView')),
      },
      { path: PATHS.resetPassword, lazy: page(() => import('@/views/auth/ResetPasswordView')) },
      {
        path: PATHS.registerChoice,
        loader: guard({ guest: true }),
        lazy: page(() => import('@/views/auth/RegisterTypeView')),
      },
      {
        path: PATHS.registerBuyer,
        loader: guard({ guest: true }),
        lazy: page(() => import('@/views/auth/RegisterBuyerView')),
      },
      { path: PATHS.register, loader: guard({ guest: true }), lazy: page(() => import('@/views/auth/RegisterView')) },

      // Vérification de l'adresse e-mail (SCRUM-24)
      {
        path: PATHS.verifyNotice,
        loader: guard({ unverified: true }),
        lazy: page(() => import('@/views/auth/VerifyEmailNoticeView')),
      },
      { path: PATHS.verifyEmail, loader: verifyEmailLoader, lazy: page(() => import('@/views/auth/EmailVerifiedView')) },

      // Paramètres du compte (SCRUM-30) : désactivation ou suppression, ouvertes à
      // tout utilisateur connecté, y compris tant que l'e-mail reste à vérifier.
      {
        path: PATHS.account,
        loader: guard({ authenticated: true }),
        lazy: page(() => import('@/layouts/AppLayout')),
        children: [
          { index: true, lazy: page(() => import('@/views/account/AccountSettingsView')) },
        ],
      },

      // Espaces par rôle
      space(PATHS.supplier, ROLES.SUPPLIER, () => import('@/views/supplier/SupplierDashboard'), [
        {
          path: PATHS.supplierPending,
          loader: supplierOnly(true),
          lazy: page(() => import('@/views/supplier/SupplierPendingView')),
        },
      ]),
      space(PATHS.buyer, ROLES.BUYER, () => import('@/views/buyer/BuyerDashboard')),
      space(PATHS.admin, ROLES.ADMIN, () => import('@/views/admin/AdminDashboard')),

      // Erreurs
      { path: PATHS.forbidden, lazy: page(() => import('@/views/errors/ForbiddenView')) },
      { path: '*', lazy: page(() => import('@/views/errors/NotFoundView')) },
    ],
  },
]
