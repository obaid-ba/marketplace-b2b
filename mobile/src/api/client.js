import { API_URL } from '../config'

let authToken = null
let onUnauthorized = null

export function setToken(token) {
  authToken = token
}

/** Appelée sur une réponse 401 (jeton expiré) : l'application revient à l'écran public. */
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

export class ApiError extends Error {
  constructor(message, status, errors) {
    super(message)
    this.status = status
    this.errors = errors
  }
}

const TIMEOUT_MS = 20000

/**
 * Appel à l'API Laravel (JSON). Renvoie le corps décodé ou lève une ApiError avec un message en français.
 */
export async function api(path, { method = 'GET', body, params } = {}) {
  const query = params
    ? '?' +
      new URLSearchParams(
        Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
      ).toString()
    : ''

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  let response
  try {
    response = await fetch(`${API_URL}${path}${query}`, {
      method,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    // L'adresse est affichée pour aider à régler le réseau (backend lancé avec --host=0.0.0.0, même Wi-Fi, pare-feu).
    throw new ApiError(`Impossible de joindre le serveur (${API_URL}). Vérifiez que le backend tourne et que le téléphone est sur le même Wi-Fi que le PC.`, 0)
  } finally {
    clearTimeout(timer)
  }

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    if (response.status === 401 && authToken && onUnauthorized) onUnauthorized()
    const message =
      data?.message ||
      (response.status === 429 ? 'Trop de tentatives. Réessayez dans un instant.' : 'Une erreur est survenue. Réessayez.')
    throw new ApiError(message, response.status, data?.errors)
  }

  return data
}

/**
 * Les images renvoyées par l'API pointent vers « localhost » : sur un téléphone ou un émulateur,
 * on remplace l'hôte par celui de l'API.
 */
export function mediaUrl(url) {
  if (!url) return null
  try {
    const api = new URL(API_URL)
    const media = new URL(url, api.origin)
    if (media.hostname === 'localhost' || media.hostname === '127.0.0.1') {
      media.protocol = api.protocol
      media.host = api.host
    }
    return media.toString()
  } catch {
    return url
  }
}
