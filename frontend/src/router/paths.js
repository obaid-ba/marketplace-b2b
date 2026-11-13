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
  supplier: '/fournisseur',
  supplierPending: '/fournisseur/en-attente',
  supplierProfile: '/fournisseur/profil', // Profil de l'entreprise (SCRUM-28)
  buyer: '/porteur',
  admin: '/admin',
  forbidden: '/acces-refuse',
})

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
