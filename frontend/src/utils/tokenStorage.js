// Stockage du jeton Sanctum. localStorage peut être indisponible (navigation privée) : on ne plante pas.
const KEY = 'mb2b_token'

export const tokenStorage = {
  get() {
    try {
      return localStorage.getItem(KEY)
    } catch {
      return null
    }
  },
  set(token) {
    try {
      localStorage.setItem(KEY, token)
    } catch {
      /* ignoré */
    }
  },
  clear() {
    try {
      localStorage.removeItem(KEY)
    } catch {
      /* ignoré */
    }
  },
}
