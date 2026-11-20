import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { fetchBuyerOrder } from '@/api/orders'
import PageHeader from '@/components/PageHeader'
import StatusBadge from '@/components/StatusBadge'
import { buyerTenderPath, PATHS } from '@/router/paths'
import { formatAmount } from '@/utils/money'
import { formatDate } from '@/utils/period'

const ORDER_VARIANTS = {
  validée: 'success',
  'en préparation': 'pending',
  'en livraison': 'pending',
  livrée: 'success',
  clôturée: 'neutral',
}

const STEPS = ['validée', 'en préparation', 'en livraison', 'livrée']

/**
 * Suivi d'une commande issue d'un devis accepté (SCRUM-48 / F14) :
 * lignes, coordonnées du fournisseur, conditions et historique des étapes.
 */
export default function OrderDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true

    setLoading(true)
    fetchBuyerOrder(id)
      .then((data) => {
        if (active) setOrder(data)
      })
      .catch((failure) => {
        if (active) setError(failure.userMessage ?? 'Impossible de charger cette commande.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [id])

  if (loading) return <div className="card text-sm text-muted">Chargement de la commande…</div>

  if (error || !order) {
    return (
      <div className="card border-danger-soft bg-danger-soft/40 text-sm text-danger">
        {error ?? 'Commande introuvable.'}
        <Link to={PATHS.buyerOrders} className="btn-secondary ml-4">
          Mes commandes
        </Link>
      </div>
    )
  }

  const currentStep = STEPS.indexOf(order.status)

  return (
    <>
      <PageHeader
        title={`Commande n° ${order.id}`}
        subtitle={`Créée le ${formatDate(order.created_at?.slice(0, 10))} — ${order.origin_label ?? 'Devis accepté'}`}
        actions={
          <Link to={PATHS.buyerOrders} className="btn-secondary">
            Mes commandes
          </Link>
        }
      />

      {location.state?.notice && (
        <div className="mb-4 rounded-lg border border-success-soft bg-success-soft/60 px-4 py-3 text-sm text-success">
          {location.state.notice}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted">Montant total</p>
                <p className="text-3xl font-semibold text-ink">{formatAmount(order.total)}</p>
              </div>
              <StatusBadge variant={ORDER_VARIANTS[order.status] ?? 'neutral'}>
                {order.status_label ?? order.status}
              </StatusBadge>
            </div>

            <div className="mt-6">
              <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {STEPS.map((step, index) => {
                  const reached = currentStep >= index
                  return (
                    <li key={step} className="flex flex-col gap-1">
                      <span
                        aria-hidden="true"
                        className={`h-1.5 rounded-full ${reached ? 'bg-brand-600' : 'bg-line'}`}
                      />
                      <span className={`text-xs capitalize ${reached ? 'font-medium text-ink' : 'text-muted'}`}>
                        {step}
                      </span>
                    </li>
                  )
                })}
              </ol>
            </div>
          </section>

          <section className="card">
            <h2 className="text-sm font-semibold text-ink">Lignes de la commande</h2>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="pb-2 font-medium">Désignation</th>
                  <th className="pb-2 text-right font-medium">Qté</th>
                  <th className="pb-2 text-right font-medium">Prix unitaire</th>
                  <th className="pb-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {(order.items ?? []).map((item) => (
                  <tr key={item.id} className="border-b border-line last:border-0">
                    <td className="py-2.5 pr-2 text-ink">{item.label}</td>
                    <td className="py-2.5 text-right text-muted">{item.quantity}</td>
                    <td className="py-2.5 text-right text-muted">{formatAmount(item.unit_price)}</td>
                    <td className="py-2.5 text-right font-medium text-ink">{formatAmount(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {order.quote && (
            <section className="card">
              <h2 className="text-sm font-semibold text-ink">Devis à l’origine de la commande</h2>
              <p className="mt-2 text-sm text-ink">
                {order.quote.tender?.title ?? 'Demande supprimée'}
                {order.quote.tender?.id && (
                  <>
                    {' · '}
                    <Link to={buyerTenderPath(order.quote.tender.id)} className="text-brand-600 hover:underline">
                      Voir la demande
                    </Link>
                  </>
                )}
              </p>

              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div className="flex justify-between gap-3 sm:block">
                  <dt className="text-muted">Montant du devis</dt>
                  <dd className="font-medium text-ink">{formatAmount(order.quote.amount)}</dd>
                </div>
                <div className="flex justify-between gap-3 sm:block">
                  <dt className="text-muted">Délai proposé</dt>
                  <dd className="font-medium text-ink">{order.quote.delivery_days} jour(s)</dd>
                </div>
              </dl>

              {order.quote.conditions && (
                <p className="mt-3 whitespace-pre-line rounded-lg bg-page px-3 py-2 text-sm text-muted">
                  {order.quote.conditions}
                </p>
              )}
            </section>
          )}
        </div>

        <aside className="space-y-6">
          <section className="card">
            <h2 className="text-sm font-semibold text-ink">Fournisseur</h2>
            <p className="mt-2 text-base font-medium text-ink">{order.supplier?.company_name ?? '—'}</p>
            {order.supplier?.rating_avg > 0 && (
              <p className="text-sm text-muted">
                ★ {Number(order.supplier.rating_avg).toFixed(1)} / 5 ({order.supplier.reviews_count} avis)
              </p>
            )}

            <dl className="mt-3 space-y-1 text-sm">
              {order.supplier?.professional_email && (
                <div>
                  <dt className="text-muted">E-mail</dt>
                  <dd className="break-all text-ink">{order.supplier.professional_email}</dd>
                </div>
              )}
              {order.supplier?.professional_phone && (
                <div>
                  <dt className="text-muted">Téléphone</dt>
                  <dd className="text-ink">{order.supplier.professional_phone}</dd>
                </div>
              )}
            </dl>
          </section>

          <section className="card">
            <h2 className="text-sm font-semibold text-ink">Historique</h2>
            <ol className="mt-3 space-y-3">
              {(order.status_history ?? []).map((history) => (
                <li key={history.id} className="border-l-2 border-brand-100 pl-3">
                  <p className="text-sm font-medium text-ink">{history.status_label ?? history.status}</p>
                  <p className="text-xs text-muted">
                    {formatDate(history.changed_at?.slice(0, 10))}
                    {history.changed_by && ` · ${history.changed_by}`}
                  </p>
                </li>
              ))}
            </ol>
            {order.origin === 'devis' && (
              <p className="mt-4 rounded-lg bg-page px-3 py-2 text-xs text-muted">
                Aucun paiement en ligne n’est demandé : les étapes suivantes seront gérées hors plateforme.
              </p>
            )}
          </section>
        </aside>
      </div>
    </>
  )
}
