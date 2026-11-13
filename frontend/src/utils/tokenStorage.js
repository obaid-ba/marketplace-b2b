// Stockage du jeton Sanctum. Le stockage peut être indisponible (navigation privée) : on ne plante pas.
//
// « Se souvenir de moi » (SCRUM-25) :
// - coché     → localStorage : le jeton survit à la fermeture du navigateur (jusqu'à son expiration côté API) ;
// - non coché → sessionStorage : le jeton disparaît à la fermeture de l'onglet / du navigateur.
const KEY = 'mb2b_token'

function read(storage) {
  try {
    return storage.getItem(KEY)
  } catch {
    return null
  }
}

function remove(storage) {
  try {
    storage.removeItem(KEY)
  } catch {
    /* ignoré */
  }
}

export const tokenStorage = {
  get() {
    return read(localStorage) ?? read(sessionStorage)
  },
  set(token, remember = false) {
    this.clear()
    try {
      ;(remember ? localStorage : sessionStorage).setItem(KEY, token)
    } catch {
      /* ignoré */
    }
  },
  clear() {
    remove(localStorage)
    remove(sessionStorage)
  },
}
