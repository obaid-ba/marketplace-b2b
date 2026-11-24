import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { fetchMyDisputes } from '@/api/disputes'
import { DisputeStatusBadge } from '@/components/disputes/DisputeParts'
import PageHeader from '@/components/PageHeader'
import Pagination from '@/components/Pagination'
import { useRealtime } from '@/realtime/realtime'
import { disputePath, PATHS } from '@/router/paths'
import { selectUser, useAuthStore } from '@/stores/auth'
import { formatAmount } from '@/utils/money'
import { formatRelativeDate } from '@/utils/relativeDate'

/**
 * « Mes litiges » du porteur et « Litiges reçus » du fournisseur (SCRUM-67).
 * Un litige s'ouvre depuis la commande concernée ; la décision appartient à l'administration.
 */
export default function MyDisputesPage() {
  const isBuyer = useAuthStore(selectUser)?.role === 'buyer'
  const [page, setPage] = useState(1)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const latest = useRef(0)

  const load = useCallback(async () => {
    const request = ++latest.current
    try {
      const data = await fetchMyDisputes({ page })
      if (request !== latest.current) return
      setResult(data)
      setError(null)
    } catch (err) {
      if (request === latest.current) setError(err.userMessage ?? 'Impossible de charger les litiges.')
    }
  }, [page])

  useEffect(() => {
    load()
  }, [load])
  useRealtime('notification.created', load)

  return (
    <>
      <PageHeader
        title={isBuyer ? 'Mes litiges' : 'Litiges reçus'}
        subtitle={
          isBuyer
            ? "Suivez vos litiges et la décision de l'administration."
            : "Consultez les litiges ouverts sur vos commandes et la décision de l'administration."
        }
      />

      {error && (
        <div role="alert" className="card mb-4 text-sm text-danger">
          <p>{error}</p>
          <button type="button" className="btn-secondary mt-3" onClick={load}>
            Réessayer
          </button>
        </div>
      )}

      {!result && !error && <p className="card text-sm text-muted">Chargement des litiges…</p>}

      {result?.data.length === 0 && (
        <div className="card text-sm text-muted">
          {isBuyer ? (
            <>
              Vous n&apos;avez ouvert aucun litige. Pour signaler un problème, ouvrez la commande concernée dans{' '}
              <Link to={PATHS.buyerOrders} className="font-medium text-brand-600 hover:underline">
                Mes commandes
              </Link>
              .
            </>
          ) : (
            "Aucun litige n'a été ouvert sur vos commandes."
          )}
        </div>
      )}

      {result?.data.length > 0 && (
        <ul className="space-y-2">
          {result.data.map((dispute) => (
            <li key={dispute.id}>
              <Link to={disputePath(dispute.id)} className="card block transition hover:border-brand-100 hover:shadow-md">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-ink">Commande n° {dispute.order_id}</span>
                  <DisputeStatusBadge status={dispute.status} />
                  <span className="text-xs text-muted">
                    {formatAmount(dispute.order.total)} · {formatRelativeDate(dispute.created_at)}
                  </span>
                </span>
                <span className="mt-1 block text-sm text-ink">{dispute.reason}</span>
                <span className="mt-1 block text-xs text-muted">
                  {isBuyer ? `Fournisseur : ${dispute.supplier.name ?? '—'}` : `Porteur : ${dispute.buyer.name ?? '—'}`}
                  {dispute.decision && ` · Décision : ${dispute.decision}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {result && <Pagination currentPage={result.meta.current_page} lastPage={result.meta.last_page} onChange={setPage} className="mt-6" />}
    </>
  )
}
