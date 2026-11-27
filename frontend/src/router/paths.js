// Toutes les adresses de l'application au même endroit (React Router n'a pas de routes nommées).
export const PATHS = Object.freeze({
  home: '/',
  howItWorks: '/#comment-ca-marche',
  login: '/connexion',
  forgotPassword: '/mot-de-passe-oublie',
  resetPassword: '/mot-de-passe/nouveau', // page ouverte par le lien « Mot de passe oublié »
  registerChoice: '/inscription',
  register: '/inscription/fournisseur',
  registerBuyer: '/inscription/porteur',
  verifyNotice: '/verification-email', // « Consultez votre boîte mail »
  verifyEmail: '/email/verifier', // page ouverte par le lien reçu par e-mail
  account: '/parametres', // informations personnelles, e-mail et mot de passe
  notificationPreferences: '/parametres/notifications',
  catalog: '/catalogue',
  suppliers: '/fournisseurs', // annuaire public des fournisseurs
  supplier: '/fournisseur',
  supplierPending: '/fournisseur/en-attente',
  supplierProfile: '/fournisseur/profil', // Profil de l'entreprise (SCRUM-28)
  supplierTenders: '/fournisseur/demandes',
  supplierQuotes: '/fournisseur/devis',
  supplierNotifications: '/fournisseur/notifications',
  supplierProducts: '/fournisseur/produits',
  supplierProductNew: '/fournisseur/produits/nouveau',
  buyer: '/porteur',
  buyerOrders: '/porteur/commandes',
  buyerTenders: '/porteur/demandes',
  buyerTenderNew: '/porteur/demandes/nouvelle',
  buyerNotifications: '/porteur/notifications',
  buyerQuotes: '/porteur/devis',
  buyerFavorites: '/porteur/favoris',
  buyerAi: '/porteur/assistant-ia', // SCRUM-124 / SCRUM-79
  buyerDisputes: '/porteur/litiges', // SCRUM-67
  supplierOrders: '/fournisseur/commandes',
  supplierReviews: '/fournisseur/avis',
  supplierMessages: '/fournisseur/messagerie', // SCRUM-59
  buyerMessages: '/porteur/messagerie', // SCRUM-59
  adminDisputes: '/admin/litiges', // SCRUM-117
  adminUsers: '/admin/utilisateurs', // SCRUM-118
  adminNotifications: '/admin/notifications',
  supplierAi: '/fournisseur/assistant-ia', // SCRUM-77 / SCRUM-78
  supplierDisputes: '/fournisseur/litiges', // SCRUM-67
  admin: '/admin',
  adminSuppliers: '/admin/fournisseurs',
  adminCategories: '/admin/categories',
  adminProducts: '/admin/catalogue', // SCRUM-72
  adminReviews: '/admin/avis', // SCRUM-74
  adminAudit: '/admin/journal', // SCRUM-76
  forbidden: '/acces-refuse',
})

/** Centre de notifications de l'espace de ce rôle. */
export function notificationsPathFor(role) {
  return { supplier: PATHS.supplierNotifications, buyer: PATHS.buyerNotifications, admin: PATHS.adminNotifications }[role]
}

/** Litige vu par l'acheteur et le fournisseur (SCRUM-117). */
export function disputePath(id) {
  return `/litiges/${id}`
}

/** « Signaler un problème » sur une commande (SCRUM-117). */
export function newDisputePath(orderId) {
  return `${PATHS.buyerOrders}/${orderId}/litige`
}

export function adminDisputePath(id) {
  return `${PATHS.adminDisputes}/${id}`
}

export function adminUserPath(id) {
  return `${PATHS.adminUsers}/${id}`
}

/** Messagerie de l'espace de ce rôle. */
export function messagingPathFor(role) {
  return role === 'supplier' ? PATHS.supplierMessages : PATHS.buyerMessages
}

export function conversationPath(role, id) {
  return `${messagingPathFor(role)}/${id}`
}

/**
 * Suivi d'une commande (SCRUM-51, SCRUM-58).
 */
export function orderTrackingPath(id) {
  return `/orders/${id}`
}

/**
 * Fiche produit publique (SCRUM-51).
 */
export function productDetailPath(id) {
  return `/produits/${id}`
}

export function productPath(id) {
  return productDetailPath(id)
}

export function supplierProductEditPath(id) {
  return `${PATHS.supplierProducts}/${id}/modifier`
}

export function supplierTenderPath(id) {
  return `${PATHS.supplierTenders}/${id}`
}

export function buyerTenderPath(id) {
  return `${PATHS.buyerTenders}/${id}`
}

export function buyerTenderQuotesPath(id) {
  return `${PATHS.buyerQuotes}/${id}/comparer`
}

export function buyerOrderPath(id) {
  return `${PATHS.buyerOrders}/${id}`
}

export function catalogPath(params = {}) {
  const search = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  ).toString()
  return search ? `${PATHS.catalog}?${search}` : PATHS.catalog
}

/**
 * Fiche fournisseur publique (SCRUM-37, sprint S2).
 * TODO SCRUM-37 : la route n'existe pas encore, le lien affiche la page 404 en attendant.
 */
export function supplierPublicPath(id) {
  return `/fournisseurs/${id}`
}

/** Adresse de la page de connexion, en retenant la page à rouvrir ensuite. */
export function loginPath(redirect) {
  return redirect ? `${PATHS.login}?redirect=${encodeURIComponent(redirect)}` : PATHS.login
}

/**
 * N'accepte qu'une adresse interne ("/porteur", pas "//site.com" ni "https://…"),
 * pour qu'un lien piégé ?redirect=… ne renvoie pas l'utilisateur vers un autre site.
 */
export function safeRedirect(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : null
}
