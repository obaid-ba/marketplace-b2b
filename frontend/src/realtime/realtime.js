import { useEffect, useRef } from 'react'
import { http } from '@/api/http'
import { selectIsAuthenticated, useAuthStore } from '@/stores/auth'

/**
 * Temps réel (Laravel Reverb) : un canal privé par utilisateur.
 *
 * Événements : message.sent, conversation.read, notification.created, et « connected »
 * (connexion établie ou rétablie : les pages ouvertes rattrapent ce qu'elles ont manqué).
 *
 * Sans VITE_REVERB_APP_KEY, ou si Reverb est arrêté, rien ne casse : les pages se rafraîchissent
 * à intervalle régulier (voir isRealtimeConnected).
 */
const EVENTS = ['message.sent', 'conversation.read', 'notification.created']

const listeners = new Map()
let echo = null
let connectedUserId = null
let connected = false

export function isRealtimeConnected() {
  return connected
}

/** @returns {() => void} fonction pour ne plus écouter */
export function onRealtime(event, callback) {
  if (!listeners.has(event)) listeners.set(event, new Set())
  listeners.get(event).add(callback)
  return () => listeners.get(event)?.delete(callback)
}

export function emitRealtime(event, payload) {
  listeners.get(event)?.forEach((callback) => callback(payload))
}

/** Version hook : la fonction peut changer à chaque rendu sans se réabonner. */
export function useRealtime(event, callback) {
  const latest = useRef(callback)
  useEffect(() => {
    latest.current = callback
  })
  useEffect(() => onRealtime(event, (payload) => latest.current(payload)), [event])
}

async function connect(userId) {
  connectedUserId = userId
  const key = import.meta.env.VITE_REVERB_APP_KEY
  if (!key) return

  // Chargées seulement pour un utilisateur connecté : les visiteurs n'en ont pas besoin.
  const [{ default: Echo }, { default: Pusher }] = await Promise.all([import('laravel-echo'), import('pusher-js')])
  if (connectedUserId !== userId) return // déconnecté entre-temps

  const scheme = import.meta.env.VITE_REVERB_SCHEME ?? 'http'
  const port = Number(import.meta.env.VITE_REVERB_PORT ?? 8080)

  echo = new Echo({
    broadcaster: 'reverb',
    Pusher,
    key,
    wsHost: import.meta.env.VITE_REVERB_HOST ?? window.location.hostname,
    wsPort: port,
    wssPort: port,
    forceTLS: scheme === 'https',
    enabledTransports: ['ws', 'wss'],
    // Même jeton Bearer que le reste de l'API.
    authorizer: (channel) => ({
      authorize: (socketId, callback) =>
        http
          .post('/broadcasting/auth', { socket_id: socketId, channel_name: channel.name }, { skipAuthRedirect: true })
          .then(({ data }) => callback(null, data))
          .catch((error) => callback(error, null)),
    }),
  })

  const channel = echo.private(`user.${userId}`)
  EVENTS.forEach((event) => channel.listen(`.${event}`, (payload) => emitRealtime(event, payload)))
  // Connecté = abonné au canal (pas seulement au serveur) : sinon les événements n'arrivent pas.
  channel.subscribed(() => {
    connected = true
    emitRealtime('connected')
  })
  echo.connector.pusher.connection.bind('state_change', ({ current }) => {
    if (current !== 'connected') connected = false
  })
}

function disconnect() {
  connectedUserId = null
  connected = false
  echo?.disconnect()
  echo = null
}

/** Suit la connexion de l'utilisateur (appelé une fois dans main.jsx). */
export function startRealtime() {
  const sync = (state) => {
    const userId = selectIsAuthenticated(state) ? state.user.id : null
    if (userId === connectedUserId) return
    disconnect()
    if (userId) connect(userId).catch(() => {}) // le rafraîchissement régulier prend le relais
  }
  sync(useAuthStore.getState())
  return useAuthStore.subscribe(sync)
}
