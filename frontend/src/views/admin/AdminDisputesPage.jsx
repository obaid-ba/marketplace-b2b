import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { fetchAdminDisputes } from '@/api/disputes'
import { DISPUTE_STATUS, DisputeStatusBadge } from '@/components/disputes/DisputeParts'
import EmptyState from '@/components/EmptyState'
import PageHeader from '@/components/PageHeader'
import Pagination from '@/components/Pagination'
import { useRealtime } from '@/realtime/realtime'
import { adminDisputePath } from '@/router/paths'
import { formatAmount } from '@/utils/money'
import { formatRelativeDate } from '@/utils/relativeDate'

const TABS = [
  { value: '', label: 'Tous' },
  { value: DISPUTE_STATUS.OPEN, label: 'Ouverts' },
  { value: DISPUTE_STATUS.IN_PROGRESS, label: 'En cours' },
  { value: DISPUTE_STATUS.DECIDED, label: 'Décidés' },
]

/** Gestion des litiges (SCRUM-117 / F23) : les plus urgents d'abord. Filtres conservés dans l'adresse. */
export default function AdminDisputesPage() {
  const [params, setParams] = useSearchParams()
  const status = params.get('statut') ?? ''
  const search = params.get('q') ?? ''
  const mine = params.get('moi') === '1'
  const page = Math.max(1, Number(params.get('page')) || 1)

  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [text, setText] = useState(search)
  const latest = useRef(0)

  const load = useCallback(async () => {
    const request = ++latest.current
    try {
      const data = await fetchAdminDisputes({ status: status || undefined, search: search || undefined, mine: mine ? 1 : undefined, page })
      if (request !== latest.current) return
      setResult(data)
      setError(null)
    } catch (err) {
      if (request === latest.current) setError(err.userMessage ?? 'Impossible de charger les litiges.')
    }
  }, [mine, page, search, status])

  useEffect(() => {
    load()
  }, [load])
  useRealtime('notification.created', load)

  function update(changes) {
    setParams((current) => {
      const next = new URLSearchParams(current)
      next.delete('page')
      Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)))
      return next
    })
  }

  const total = result ? Object.values(result.counts).reduce((sum, count) => sum + count, 0) : null
  const countFor = (value) => (result ? (value ? result.counts[value] : total) : null)

  return (
    <>
      <PageHeader title="Litiges" subtitle="Les litiges ouverts les plus anciens d'abord." />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.label}
            type="button"
            aria-pressed={status === tab.value}
            onClick={() => update({ statut: tab.value })}
            className={status === tab.value ? 'btn-primary' : 'btn-secondary'}
          >
            {tab.label}
            {countFor(tab.value) !== null && ` (${countFor(tab.value)})`}
          </button>
        ))}
        <label className="ml-2 flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" className="accent-brand-600" checked={mine} onChange={(event) => update({ moi: event.target.checked ? '1' : '' })} />
          Pris en charge par moi
        </label>
        <form
          role="search"
          className="flex w-full gap-2 sm:ml-auto sm:w-auto"
          onSubmit={(event) => {
            event.preventDefault()
            update({ q: text.trim() })
          }}
        >
          <input type="search" className="input sm:w-64" placeholder="N° de commande, société…" aria-label="Rechercher un litige" value={text} onChange={(event) => setText(event.target.value)} />
          <button type="submit" className="btn-secondary">
            Rechercher
          </button>
        </form>
      </div>

      {error && (
        <div role="alert" className="card mb-4 border-danger-soft bg-danger-soft/40 text-sm text-danger">
          {error}{' '}
          <button type="button" className="font-medium underline" onClick={load}>
            Réessayer
          </button>
        </div>
      )}
      {!result && !error && <div className="card text-sm text-muted">Chargement des litiges…</div>}
      {result?.data.length === 0 && <EmptyState title="Aucun litige" description="Aucun litige ne correspond à ces critères." />}

      {result?.data.length > 0 && (
        <ul className="space-y-2">
          {result.data.map((dispute) => (
            <li key={dispute.id}>
              <Link
                to={adminDisputePath(dispute.id)}
                className="flex flex-col gap-2 rounded-xl border border-line bg-surface px-4 py-3 transition hover:border-brand-100 hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink">Commande n° {dispute.order_id}</span>
                    <DisputeStatusBadge status={dispute.status} />
                  </span>
                  <span className="mt-1 block truncate text-sm text-muted">
                    {dispute.reason} · {dispute.buyer.name} → {dispute.supplier.name}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col text-sm sm:items-end">
                  <span className="font-medium text-ink">{formatAmount(dispute.order.total)}</span>
                  <span className="text-xs text-muted">
                    {formatRelativeDate(dispute.created_at)}
                    {dispute.assigned_admin && ` · ${dispute.assigned_admin.name}`}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {result && (
        <Pagination
          className="mt-6"
          currentPage={result.meta.current_page}
          lastPage={result.meta.last_page}
          onChange={(value) =>
            setParams((current) => {
              const next = new URLSearchParams(current)
              next.set('page', String(value))
              return next
            })
          }
        />
      )}
    </>
  )
}
