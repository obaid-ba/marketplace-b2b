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

/**
 * Espace réservé à un rôle : contrôle d'accès + mise en page + tableau de bord (+ autres pages).
 * Le titre de chaque page (handle.crumb) alimente le fil d'Ariane de l'espace fournisseur.
 */
function space(path, role, loadDashboard, children = [], loadLayout = () => import('@/layouts/AppLayout')) {
  return {
    path,
    loader: guard({ roles: [role] }),
    lazy: page(loadLayout),
    children: [
      // Fournisseur : tableau de bord seulement une fois validé par l'admin (voir guard.js).
      {
        index: true,
        loader: role === ROLES.SUPPLIER ? supplierOnly(false) : undefined,
        handle: { crumb: 'Tableau de bord' },
        lazy: page(loadDashboard),
      },
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
      { path: PATHS.catalog, lazy: page(() => import('@/views/catalog/CatalogView')) },
      { path: '/produits/:productId', lazy: page(() => import('@/views/products/ProductPage')) },
      { path: '/fournisseurs/:supplierId', lazy: page(() => import('@/views/suppliers/SupplierPublicPage')) },
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

      // Paramètres du compte (SCRUM-27) : ouverts à tout utilisateur connecté,
      // y compris tant que la nouvelle adresse e-mail attend sa vérification.
      {
        path: PATHS.account,
        loader: guard({ authenticated: true }),
        lazy: page(() => import('@/layouts/AppLayout')),
        children: [
          { index: true, lazy: page(() => import('@/views/account/AccountSettingsView')) },
          {
            path: 'notifications',
            handle: { crumb: 'Préférences de notification' },
            lazy: page(() => import('@/views/notifications/NotificationPreferencesPage')),
          },
        ],
      },

      // Compte fournisseur en attente de validation (SCRUM-27) : hors de l'espace fournisseur,
      // dans la mise en page d'authentification (maquette A5). Réservé à un fournisseur non validé.
      {
        path: PATHS.supplierPending,
        loader: supplierOnly(true),
        lazy: page(() => import('@/views/supplier/PendingAccountPage')),
      },

      // Suivi de commande (SCRUM-51, SCRUM-58)
      {
        path: '/orders/:id',
        loader: guard({ authenticated: true }),
        lazy: page(() => import('@/layouts/AppLayout')),
        children: [
          { index: true, lazy: page(() => import('@/views/orders/OrderTrackingPage')) },
        ],
      },
      // Litige (SCRUM-117) : l'API n'y donne accès qu'aux deux parties de la commande.
      {
        path: '/litiges/:id',
        loader: guard({ roles: [ROLES.BUYER, ROLES.SUPPLIER] }),
        lazy: page(() => import('@/layouts/AppLayout')),
        children: [{ index: true, lazy: page(() => import('@/views/disputes/DisputePage')) }],
      },
      {
        path: '/commandes/:id',
        loader: guard({ authenticated: true }),
        lazy: page(() => import('@/layouts/AppLayout')),
        children: [
          { index: true, lazy: page(() => import('@/views/orders/OrderTrackingPage')) },
        ],
      },

      // Espaces par rôle
      space(
        PATHS.supplier,
        ROLES.SUPPLIER,
        () => import('@/views/supplier/SupplierDashboard'),
        [
          {
            path: PATHS.supplierTenders,
            handle: { crumb: 'Demandes reçues' },
            loader: supplierOnly(false),
            lazy: page(() => import('@/views/supplier/ReceivedTendersPage')),
          },
          {
            path: `${PATHS.supplierTenders}/:id`,
            handle: { crumb: 'Demande reçue' },
            loader: supplierOnly(false),
            lazy: page(() => import('@/views/supplier/ReceivedTenderDetailPage')),
          },
          {
            path: PATHS.supplierQuotes,
            handle: { crumb: 'Mes devis' },
            loader: supplierOnly(false),
            lazy: page(() => import('@/views/supplier/MyQuotesPage')),
          },
          {
            path: PATHS.supplierNotifications,
            handle: { crumb: 'Notifications' },
            lazy: page(() => import('@/views/notifications/NotificationsPage')),
          },
          {
            path: PATHS.supplierProducts,
            loader: supplierOnly(false),
            handle: { crumb: 'Mes produits' },
            lazy: page(() => import('@/views/supplier/products/MyProductsPage')),
          },
          {
            path: PATHS.supplierProductNew,
            loader: supplierOnly(false),
            handle: { crumb: 'Mes produits' },
            lazy: page(() => import('@/views/supplier/products/ProductFormPage')),
          },
          {
            path: `${PATHS.supplierProducts}/:productId/modifier`,
            loader: supplierOnly(false),
            handle: { crumb: 'Mes produits' },
            lazy: page(() => import('@/views/supplier/products/ProductFormPage')),
          },
          // Profil de l'entreprise (SCRUM-28) : ouvert aussi à un fournisseur pas encore validé,
          // qui peut compléter son profil sans pouvoir le publier.
          {
            path: PATHS.supplierProfile,
            handle: { crumb: "Profil de l'entreprise" },
            lazy: page(() => import('@/views/supplier/CompanyProfilePage')),
          },
          {
            path: PATHS.supplierOrders,
            loader: supplierOnly(false),
            handle: { crumb: 'Mes commandes' },
            lazy: page(() => import('@/views/supplier/SupplierOrdersPage')),
          },
          {
            path: PATHS.supplierReviews,
            loader: supplierOnly(false),
            handle: { crumb: 'Mes avis' },
            lazy: page(() => import('@/views/supplier/SupplierReviewsPage')),
          },
          {
            path: `${PATHS.supplierMessages}/:conversationId?`,
            loader: supplierOnly(false),
            handle: { crumb: 'Messagerie' },
            lazy: page(() => import('@/views/messaging/MessagingPage')),
          },
          {
            path: PATHS.supplierDisputes,
            loader: supplierOnly(false),
            handle: { crumb: 'Litiges reçus' },
            lazy: page(() => import('@/views/disputes/MyDisputesPage')),
          },
          {
            path: PATHS.supplierAi,
            loader: supplierOnly(false),
            handle: { crumb: 'Assistant IA' },
            lazy: page(() => import('@/views/supplier/SupplierAiPage')),
          },
        ],
        () => import('@/layouts/SupplierLayout'),
      ),
      space(
        PATHS.buyer,
        ROLES.BUYER,
        () => import('@/views/buyer/BuyerDashboard'),
        [
          {
            path: PATHS.buyerTenders,
            handle: { crumb: 'Mes demandes' },
            lazy: page(() => import('@/views/buyer/TendersPage')),
          },
          {
            path: PATHS.buyerTenderNew,
            handle: { crumb: 'Nouvelle demande' },
            lazy: page(() => import('@/views/buyer/NewTenderPage')),
          },
          {
            path: `${PATHS.buyerTenders}/:id`,
            handle: { crumb: 'Détail de la demande' },
            lazy: page(() => import('@/views/buyer/TenderDetailPage')),
          },
          {
            path: `${PATHS.buyerQuotes}/:id/comparer`,
            handle: { crumb: 'Comparer les devis' },
            lazy: page(() => import('@/views/buyer/CompareQuotesPage')),
          },
          // Adresse utilisée par les notifications « Nouveau devis » (e-mails déjà envoyés compris).
          {
            path: `${PATHS.buyerTenders}/:id/devis`,
            handle: { crumb: 'Comparer les devis' },
            lazy: page(() => import('@/views/buyer/CompareQuotesPage')),
          },
          {
            path: PATHS.buyerFavorites,
            handle: { crumb: 'Fournisseurs favoris' },
            lazy: page(() => import('@/views/buyer/FavoriteSuppliersPage')),
          },
          {
            path: PATHS.buyerOrders,
            handle: { crumb: 'Mes commandes' },
            lazy: page(() => import('@/views/buyer/BuyerOrdersPage')),
          },
          {
            path: `${PATHS.buyerOrders}/:id/litige`,
            handle: { crumb: 'Signaler un problème' },
            lazy: page(() => import('@/views/disputes/NewDisputePage')),
          },
          {
            path: `${PATHS.buyerOrders}/:id`,
            handle: { crumb: 'Suivi de commande' },
            lazy: page(() => import('@/views/buyer/OrderDetailPage')),
          },
          {
            path: `${PATHS.buyerMessages}/:conversationId?`,
            handle: { crumb: 'Messagerie' },
            lazy: page(() => import('@/views/messaging/MessagingPage')),
          },
          {
            path: PATHS.buyerNotifications,
            handle: { crumb: 'Notifications' },
            lazy: page(() => import('@/views/notifications/NotificationsPage')),
          },
          {
            path: PATHS.buyerDisputes,
            handle: { crumb: 'Mes litiges' },
            lazy: page(() => import('@/views/disputes/MyDisputesPage')),
          },
          {
            path: PATHS.buyerAi,
            handle: { crumb: 'Assistant IA' },
            lazy: page(() => import('@/views/buyer/BuyerAiPage')),
          },
        ],
        () => import('@/layouts/BuyerLayout'),
      ),
      space(
        PATHS.admin,
        ROLES.ADMIN,
        () => import('@/views/admin/AdminDashboardView'),
        [
          {
            path: PATHS.adminSuppliers,
            lazy: page(() => import('@/views/admin/AdminDashboard')),
          },
          {
            path: PATHS.adminCategories,
            lazy: page(() => import('@/views/admin/CategoryManagementPage')),
          },
          {
            path: PATHS.adminUsers,
            handle: { crumb: 'Utilisateurs' },
            lazy: page(() => import('@/views/admin/AdminUsersPage')),
          },
          {
            path: `${PATHS.adminUsers}/:id`,
            handle: { crumb: 'Utilisateurs' },
            lazy: page(() => import('@/views/admin/AdminUserPage')),
          },
          {
            path: PATHS.adminProducts,
            handle: { crumb: 'Contrôle du catalogue' },
            lazy: page(() => import('@/views/admin/AdminProductsPage')),
          },
          {
            path: PATHS.adminReviews,
            handle: { crumb: 'Avis signalés' },
            lazy: page(() => import('@/views/admin/AdminReviewsPage')),
          },
          {
            path: PATHS.adminDisputes,
            handle: { crumb: 'Litiges' },
            lazy: page(() => import('@/views/admin/AdminDisputesPage')),
          },
          {
            path: `${PATHS.adminDisputes}/:id`,
            handle: { crumb: 'Litiges' },
            lazy: page(() => import('@/views/admin/AdminDisputePage')),
          },
          {
            path: PATHS.adminNotifications,
            handle: { crumb: 'Notifications' },
            lazy: page(() => import('@/views/notifications/NotificationsPage')),
          },
        ],
        () => import('@/layouts/AdminLayout'),
      ),

      // Erreurs
      { path: PATHS.forbidden, lazy: page(() => import('@/views/errors/ForbiddenView')) },
      { path: '*', lazy: page(() => import('@/views/errors/NotFoundView')) },
    ],
  },
]
