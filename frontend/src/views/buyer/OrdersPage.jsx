import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { fetchBuyerOrders } from '@/api/orders'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/dashboard/EmptyState'
import StatusBadge from '@/components/StatusBadge'
import { buyerOrderPath, PATHS } from '@/router/paths'
import { formatAmount } from '@/utils/money'
import { formatDate } from '@/utils/period'

const ORDER_VARIANTS = {
  validée: 'success',
  'en préparation': 'pending',
  'en livraison': 'pending',
  livrée: 'success',
  clôturée: 'neutral',
}

/**
 * Commandes du porteur créées par acceptation d'un devis (SCRUM-48 / F14).
 */
export default function OrdersPage() {
  const location = useLocation()
  const [page, setPage] = useState(1)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setResult(await fetchBuyerOrders({ page, per_page: 10 }))
    } catch (failure) {
      setError(failure.userMessage ?? 'Impossible de charger vos commandes.')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    load()
  }, [load])

  const orders = result?.data ?? []
  const meta = result?.meta

  return (
    <>
      <PageHeader
        title="Mes commandes"
        subtitle="Commandes créées à partir d’un devis accepté, sans paiement en ligne."
        actions={
          <Link to={PATHS.buyerTenders} className="btn-secondary">
            Mes demandes
          </Link>
        }
      />

      {location.state?.notice && (
        <div className="mb-4 rounded-lg border border-success-soft bg-success-soft/60 px-4 py-3 text-sm text-success">
          {location.state.notice}
        </div>
      )}

      {loading && <div className="card text-sm text-muted">Chargement de vos commandes…</div>}

      {!loading && error && (
        <div className="card border-danger-soft bg-danger-soft/40 text-sm text-danger">
          {error}
          <button type="button" className="btn-secondary ml-4" onClick={load}>
            Réessayer
          </button>
        </div>
      )}

      {!loading && !error && orders.length === 0 && (
        <EmptyState
          title="Aucune commande"
          description="Une commande est créée automatiquement quand vous acceptez un devis."
          action={
            <Link to={PATHS.buyerTenders} className="btn-secondary">
              Voir mes demandes
            </Link>
          }
        />
      )}

      {!loading && !error && orders.length > 0 && (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li key={order.id} className="card">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={buyerOrderPath(order.id)}
                      className="text-[17px] font-semibold text-ink hover:text-brand-600"
                    >
                      Commande n° {order.id}
                    </Link>
                    <StatusBadge variant={ORDER_VARIANTS[order.status] ?? 'neutral'}>
                      {order.status_label ?? order.status}
                    </StatusBadge>
                  </div>

                  <p className="mt-1 truncate text-sm text-muted">
                    Fournisseur : <span className="text-ink">{order.supplier?.company_name ?? '—'}</span>
                  </p>
                  <p className="text-sm text-muted">
                    {order.quote?.tender?.title ?? 'Demande supprimée'} ·{' '}
                    {order.items_count ?? 0} ligne{(order.items_count ?? 0) > 1 ? 's' : ''} ·{' '}
                    {formatDate(order.created_at?.slice(0, 10))}
                  </p>
                </div>

                <div className="flex items-center gap-4 sm:flex-col sm:items-end">
                  <p className="text-xl font-semibold text-ink">{formatAmount(order.total)}</p>
                  <Link to={buyerOrderPath(order.id)} className="btn-secondary">
                    Suivre
                  </Link>
                </div>
              </div>
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
