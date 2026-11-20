import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/api/notifications'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/dashboard/EmptyState'
import { PATHS } from '@/router/paths'

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

/**
 * Centre de notifications (SCRUM-62 / F15) : liste paginée, marquage lu,
 * et accès aux préférences par événement / canal.
 */
export default function NotificationsPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [acting, setActing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setResult(await fetchNotifications({ page, per_page: 20 }))
    } catch (failure) {
      setError(failure.userMessage ?? 'Impossible de charger les notifications.')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    load()
  }, [load])

  const notifications = result?.data ?? []
  const meta = result?.meta
  const unread = notifications.filter((item) => !item.read_at).length

  async function handleOpen(item) {
    if (!item.read_at) {
      try {
        await markNotificationRead(item.id)
        setResult((current) =>
          current
            ? {
                ...current,
                data: current.data.map((entry) =>
                  entry.id === item.id ? { ...entry, read_at: new Date().toISOString() } : entry,
                ),
              }
            : current,
        )
      } catch {
        // La navigation reste possible même si le marquage échoue.
      }
    }

    if (item.url) navigate(item.url)
  }

  async function handleMarkAll() {
    setActing(true)
    try {
      await markAllNotificationsRead()
      setResult((current) =>
        current
          ? {
              ...current,
              data: current.data.map((entry) => ({
                ...entry,
                read_at: entry.read_at ?? new Date().toISOString(),
              })),
            }
          : current,
      )
    } catch (failure) {
      setError(failure.userMessage ?? 'Le marquage a échoué.')
    } finally {
      setActing(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Demandes, devis, commandes et décisions de votre compte."
        actions={
          <>
            <Link to={PATHS.notificationPreferences} className="btn-secondary">
              Préférences
            </Link>
            <button
              type="button"
              className="btn-primary"
              onClick={handleMarkAll}
              disabled={acting || unread === 0}
            >
              {acting ? 'Marquage…' : 'Tout marquer comme lu'}
            </button>
          </>
        }
      />

      {loading && <div className="card text-sm text-muted">Chargement des notifications…</div>}

      {!loading && error && (
        <div className="card border-danger-soft bg-danger-soft/40 text-sm text-danger">
          {error}
          <button type="button" className="btn-secondary ml-4" onClick={load}>
            Réessayer
          </button>
        </div>
      )}

      {!loading && !error && notifications.length === 0 && (
        <EmptyState
          title="Aucune notification"
          description="Vous serez prévenu ici des nouvelles demandes, des devis reçus et des décisions."
        />
      )}

      {!loading && !error && notifications.length > 0 && (
        <ul className="space-y-2">
          {notifications.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => handleOpen(item)}
                className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition hover:border-brand-100 hover:bg-brand-50/40 ${
                  item.read_at ? 'border-line bg-surface' : 'border-brand-100 bg-brand-50/60'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.read_at ? 'bg-line' : 'bg-brand-600'}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-ink">{item.title}</span>
                    {!item.read_at && (
                      <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">
                        Non lue
                      </span>
                    )}
                  </span>
                  {item.message && <span className="mt-1 block text-sm text-muted">{item.message}</span>}
                  <span className="mt-1 block text-xs text-muted">{relativeTime(item.created_at)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {meta && meta.last_page > 1 && (
        <div className="mt-6 flex items-center justify-between text-sm text-muted">
          <span>
            Page {meta.current_page} sur {meta.last_page}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary"
              disabled={meta.current_page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Précédent
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={meta.current_page >= meta.last_page}
              onClick={() => setPage((value) => value + 1)}
            >
              Suivant
            </button>
          </div>
        </div>
      )}
    </>
  )
}
