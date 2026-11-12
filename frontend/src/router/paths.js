// Toutes les adresses de l'application au même endroit (React Router n'a pas de routes nommées).
export const PATHS = Object.freeze({
  home: '/',
  login: '/connexion',
  register: '/inscription/fournisseur',
  verifyNotice: '/verification-email', // « Consultez votre boîte mail »
  verifyEmail: '/email/verifier', // page ouverte par le lien reçu par e-mail
  supplier: '/fournisseur',
  supplierPending: '/fournisseur/en-attente',
  buyer: '/porteur',
  admin: '/admin',
  forbidden: '/acces-refuse',
})

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
