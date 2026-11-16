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
  supplier: '/fournisseur',
  supplierPending: '/fournisseur/en-attente',
  supplierProfile: '/fournisseur/profil', // Profil de l'entreprise (SCRUM-28)
  supplierProducts: '/fournisseur/produits', // Mes produits (SCRUM-34)
  supplierProductNew: '/fournisseur/produits/nouveau', // Ajouter un produit (SCRUM-33)
  buyer: '/porteur',
  admin: '/admin',
  adminCategories: '/admin/categories', // Gestion des catégories (SCRUM-32)
  forbidden: '/acces-refuse',
  catalog: '/catalogue', // Catalogue public (SCRUM-35)
  howItWorks: '/#comment-ca-marche', // section de la page d'accueil (SCRUM-38)
})

/** Fiche fournisseur publique (SCRUM-37). */
export function supplierPublicPath(id) {
  return `/fournisseurs/${id}`
}

/** Modifier un produit (SCRUM-33). */
export function supplierProductEditPath(id) {
  return `/fournisseur/produits/${id}/modifier`
}

/** Fiche produit publique (SCRUM-36). */
export function productPath(id) {
  return `/produits/${id}`
}

/** Catalogue filtré : catalogPath({ q: 'carton', category: 3 }) → « /catalogue?q=carton&category=3 ». */
export function catalogPath(params = {}) {
  const search = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  ).toString()
  return search ? `${PATHS.catalog}?${search}` : PATHS.catalog
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
