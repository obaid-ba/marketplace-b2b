import { create } from 'zustand'
import { http } from '@/api/http'
import { tokenStorage } from '@/utils/tokenStorage'

/**
 * État de connexion partagé par toute l'application.
 * Dans un composant : useAuthStore(selectUser). Hors composant : useAuthStore.getState().
 */
export const useAuthStore = create((set, get) => ({
  user: null,
  token: tokenStorage.get(),
  loaded: false,

  /** Charge l'utilisateur à partir du jeton enregistré (au démarrage, ou pour rafraîchir son état). */
  async fetchMe() {
    if (!get().token) {
      set({ loaded: true })
      return
    }
    try {
      const { data } = await http.get('/auth/me')
      set({ user: data })
    } catch {
      get().clear()
    } finally {
      set({ loaded: true })
    }
  },

  /** remember = « Se souvenir de moi » : session plus longue et jeton conservé après fermeture du navigateur. */
  async login(email, password, remember = false) {
    const { data } = await http.post('/auth/login', { email, password, remember, device_name: 'web' })
    tokenStorage.set(data.token, remember)
    set({ token: data.token, user: data.user, loaded: true })
    return data.user
  },

  /**
   * Inscription d'un fournisseur (multipart : compte, entreprise, justificatifs).
   * Le compte n'est pas connecté automatiquement : l'e-mail doit être vérifié.
   */
  async registerSupplier(payload) {
    const { data } = await http.post('/auth/register/supplier', payload)
    return data
  },

  /**
   * Inscription d'un porteur de projet (JSON : compte + profil acheteur).
   * Le compte n'est pas connecté automatiquement : l'e-mail doit être vérifié,
   * puis il devient actif sans validation administrateur.
   */
  async registerBuyer(payload) {
    const { data } = await http.post('/auth/register/buyer', payload)
    return data
  },

  async logout() {
    try {
      await http.post('/auth/logout')
    } finally {
      get().clear()
    }
  },

  /** Met à jour l'utilisateur connecté (ex. après la vérification de son e-mail). */
  setUser(user) {
    set({ user })
  },

  clear() {
    tokenStorage.clear()
    set({ user: null, token: null })
  },
}))

// Sélecteurs (équivalent des getters) : le composant ne se re-rend que si la valeur change.
export const selectUser = (state) => state.user
export const selectRole = (state) => state.user?.role ?? null
export const selectIsAuthenticated = (state) => Boolean(state.token && state.user)

let loading = null

/** Attend que l'utilisateur soit chargé ; un seul appel à /auth/me même si plusieurs routes le demandent. */
export function ensureAuthLoaded() {
  if (useAuthStore.getState().loaded) return Promise.resolve()
  loading ??= useAuthStore.getState().fetchMe()
  return loading
}
