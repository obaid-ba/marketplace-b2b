import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/api/notifications'
import { isRealtimeConnected, useRealtime } from '@/realtime/realtime'

/** « il y a 5 min », « hier »… pour la liste déroulante. */
function relativeTime(value) {
  if (!value) return ''
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000))
  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.round(hours / 24)
  if (days === 1) return 'hier'
  if (days < 7) return `il y a ${days} j`
  return new Date(value).toLocaleDateString('fr-FR')
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Cloche de notifications avec compteur et menu déroulant (SCRUM-62 / F15).
 * Temps réel par Reverb ; s'il n'est pas disponible, rafraîchissement toutes les 30 secondes
 * et au retour sur l'onglet.
 */
export default function NotificationBell({ notificationsPath }) {
  const navigate = useNavigate()
  const containerRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)

  const refreshCount = useCallback(async () => {
    try {
      setUnread(await fetchUnreadCount())
    } catch {
      // Le compteur ne doit jamais bloquer la navigation.
    }
  }, [])

  const refreshItems = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    try {
      const page = await fetchNotifications({ per_page: 5 })
      setItems(page.data ?? [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshCount()
    const interval = window.setInterval(() => !isRealtimeConnected() && refreshCount(), 30000)
    const onFocus = () => refreshCount()
    window.addEventListener('focus', onFocus)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [refreshCount])

  const onNotification = () => {
    refreshCount()
    if (open) refreshItems({ silent: true })
  }
  useRealtime('notification.created', onNotification)
  useRealtime('conversation.read', refreshCount) // lire une conversation marque sa notification comme lue
  useRealtime('connected', refreshCount)

  useEffect(() => {
    if (open) refreshItems()
  }, [open, refreshItems])

  useEffect(() => {
    if (!open) return undefined

    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  async function handleOpenItem(item) {
    if (!item.read_at) {
      try {
        const result = await markNotificationRead(item.id)
        setUnread(result.unread_count ?? Math.max(0, unread - 1))
        setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, read_at: new Date().toISOString() } : entry)))
      } catch {
        // On ouvre quand même la page liée.
      }
    }

    setOpen(false)
    navigate(item.url || notificationsPath)
  }

  async function handleMarkAll() {
    try {
      await markAllNotificationsRead()
      setUnread(0)
      setItems((current) => current.map((entry) => ({ ...entry, read_at: entry.read_at ?? new Date().toISOString() })))
    } catch {
      // Silencieux : le compteur sera resynchronisé au prochain rafraîchissement.
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={unread > 0 ? `Notifications, ${unread} non lues` : 'Notifications'}
        aria-expanded={open}
        className="relative grid h-10 w-10 place-items-center rounded-full text-ink transition hover:bg-brand-50 hover:text-brand-600"
      >
        <BellIcon />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-danger px-1 text-[11px] font-semibold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-4 top-16 z-40 overflow-hidden sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-80 rounded-xl border border-line bg-surface shadow-xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-semibold text-ink">Notifications</p>
            {unread > 0 && (
              <button type="button" onClick={handleMarkAll} className="text-xs font-medium text-brand-600 hover:underline">
                Tout marquer comme lu
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && <p className="px-4 py-6 text-center text-sm text-muted">Chargement…</p>}

            {!loading && items.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-muted">Aucune notification pour le moment.</p>
            )}

            {!loading &&
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleOpenItem(item)}
                  className={`block w-full border-b border-line px-4 py-3 text-left transition last:border-0 hover:bg-page ${
                    item.read_at ? 'opacity-70' : ''
                  }`}
                >
                  <span className="flex items-start gap-2">
                    {!item.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-hidden="true" />}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">{item.title}</span>
                      {item.message && <span className="mt-0.5 block truncate text-xs text-muted">{item.message}</span>}
                      <span className="mt-1 block text-[11px] text-muted">{relativeTime(item.created_at)}</span>
                    </span>
                  </span>
                </button>
              ))}
          </div>

          <Link
            to={notificationsPath}
            onClick={() => setOpen(false)}
            className="block border-t border-line px-4 py-2.5 text-center text-sm font-medium text-brand-600 hover:bg-page"
          >
            Voir toutes les notifications
          </Link>
        </div>
      )}
    </div>
  )
}
