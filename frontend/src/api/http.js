import axios from 'axios'
import { tokenStorage } from '@/utils/tokenStorage'

/**
 * Client HTTP unique pour toute l'application.
 * - ajoute le jeton Bearer à chaque requête
 * - transforme les erreurs de l'API en messages lisibles (error.userMessage)
 * - prévient l'application en cas de 401 / 403 (voir onAuthError dans main.jsx),
 *   sauf si la requête le refuse avec { skipAuthRedirect: true } (la page gère l'erreur elle-même)
 */
export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api',
  headers: { Accept: 'application/json' },
  timeout: 15000,
})

let authErrorHandler = () => {}

/** Enregistre la fonction appelée sur 401 (session expirée) ou 403 (accès refusé). */
export function onAuthError(handler) {
  authErrorHandler = handler
}

http.interceptors.request.use((config) => {
  const token = tokenStorage.get()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    error.userMessage = messageFor(error)
    error.fieldErrors = error.response?.data?.errors ?? {}

    if ((status === 401 || status === 403) && !error.config?.skipAuthRedirect) {
      authErrorHandler(status, error)
    }

    return Promise.reject(error)
  },
)

function messageFor(error) {
  if (!error.response) {
    return 'Impossible de joindre le serveur. Vérifiez votre connexion.'
  }
  const { status, data } = error.response
  if (status === 422) return data?.message ?? 'Certains champs sont invalides.'
  if (status === 429) return 'Trop de tentatives. Réessayez dans une minute.'
  if (status >= 500) return 'Erreur du serveur. Réessayez plus tard.'
  return data?.message ?? 'Une erreur est survenue.'
}
