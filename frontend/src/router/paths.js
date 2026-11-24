// Toutes les adresses de l'application au même endroit (React Router n'a pas de routes nommées).
export const PATHS = Object.freeze({
  home: '/',
  login: '/connexion',
  forgotPassword: '/mot-de-passe-oublie',
  resetPassword: '/mot-de-passe/nouveau', // page ouverte par le lien « Mot de passe oublié »
  registerChoice: '/inscription',
  register: '/inscription/fournisseur',
  registerBuyer: '/inscription/porteur',
  verifyNotice: '/verification-email', // « Consultez votre boîte mail »
  verifyEmail: '/email/verifier', // page ouverte par le lien reçu par e-mail
  account: '/parametres', // informations personnelles, e-mail et mot de passe
  notifications: '/parametres/notifications',
  catalog: '/catalogue',
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
  buyerQuotes: '/porteur/devis',
  buyerFavorites: '/porteur/favoris',
  buyerAi: '/porteur/assistant-ia', // SCRUM-124 / SCRUM-79
  buyerDisputes: '/porteur/litiges', // SCRUM-67
  buyerNotifications: '/parametres/notifications',
  notificationPreferences: '/parametres/notifications',
  supplierOrders: '/fournisseur/commandes',
  supplierReviews: '/fournisseur/avis',
  supplierAi: '/fournisseur/assistant-ia', // SCRUM-77 / SCRUM-78
  supplierDisputes: '/fournisseur/litiges', // SCRUM-67
  admin: '/admin',
  adminSuppliers: '/admin/fournisseurs',
  adminCategories: '/admin/categories',
  adminProducts: '/admin/catalogue', // SCRUM-72
  adminReviews: '/admin/avis', // SCRUM-74
  adminDisputes: '/admin/litiges', // SCRUM-73
  adminUsers: '/admin/utilisateurs', // SCRUM-71
  adminExports: '/admin/exports', // SCRUM-75
  forbidden: '/acces-refuse',
})

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
