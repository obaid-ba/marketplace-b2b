import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { fetchBuyerDashboard } from '@/api/buyerDashboard'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/dashboard/EmptyState'
import ErrorState from '@/components/dashboard/ErrorState'
import KpiCard from '@/components/dashboard/KpiCard'
import PeriodPicker from '@/components/dashboard/PeriodPicker'
import Skeleton from '@/components/dashboard/Skeleton'
import TimeSeriesChart from '@/components/dashboard/TimeSeriesChart'
import { PATHS, buyerTenderPath } from '@/router/paths'
import { selectUser, useAuthStore } from '@/stores/auth'
import { formatAmount, formatCount } from '@/utils/money'
import { defaultPeriod, formatDate } from '@/utils/period'

const CHART_LINES = [
  { key: 'orders', label: 'Commandes', color: '#12a06b' },
  { key: 'spending', label: 'Dépenses (TND)', color: '#5b4bdb' },
]

const plural = (count, singular, pluralForm = `${singular}s`) =>
  `${count} ${count > 1 ? pluralForm : singular}`

function DashboardSkeleton() {
  return (
    <div role="status" className="space-y-6" aria-busy="true" aria-label="Chargement du tableau de bord">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="card">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-3 h-8 w-20" />
          </div>
        ))}
      </div>
      <div className="card">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-4 h-72 w-full" />
      </div>
    </div>
  )
}

/**
 * Tableau de bord porteur de projet (SCRUM-121 / F27) : dépenses, commandes,
 * demandes publiées, devis en attente et fournisseurs favoris.
 */
export default function BuyerDashboard() {
  const user = useAuthStore(selectUser)
  const [period, setPeriod] = useState(() => defaultPeriod())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(
    async (range) => {
      setLoading(true)
      setError(null)
      try {
        setData(await fetchBuyerDashboard(range))
      } catch (requestError) {
        setError(requestError.userMessage ?? 'Impossible de charger le tableau de bord. Réessayez.')
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    load(period)
  }, [load, period])

  const requests = data?.published_requests ?? []
  const pendingQuotes = data?.pending_quotes ?? []
  const favorites = data?.favorite_suppliers ?? []
  const orders = data?.latest_orders ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Bonjour ${user?.name ?? ''}`.trim()}
        subtitle="Suivez vos dépenses, vos commandes et l'avancement de vos demandes."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to={PATHS.buyerAi} className="btn btn-secondary">
              Assistant IA
            </Link>
            <Link to={PATHS.buyerTenders} className="btn btn-primary">
              Mes demandes
            </Link>
          </div>
        }
      />

      <section className="card" aria-labelledby="period-title">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="period-title" className="text-sm font-semibold text-ink">
            Période analysée
          </h2>
          <p className="text-xs text-muted">
            {formatDate(period.from)} — {formatDate(period.to)}
          </p>
        </div>
        <div className="mt-4">
          <PeriodPicker from={period.from} to={period.to} onApply={setPeriod} loading={loading} />
        </div>
      </section>

      {error && !data && <ErrorState message={error} onRetry={() => load(period)} />}

      {loading && !data && <DashboardSkeleton />}

      {data && (
        <>
          <section aria-label="Indicateurs clés">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <KpiCard label="Dépenses" value={formatAmount(data.kpis.spending)} hint="Commandes passées sur la période" />
              <KpiCard label="Commandes" value={formatCount(data.kpis.orders_count)} hint="Toutes commandes confondues" />
              <KpiCard label="En cours" value={formatCount(data.kpis.orders_in_progress)} hint="Commandes non clôturées" />
              <KpiCard label="Demandes publiées" value={formatCount(data.kpis.published_requests)} hint="Ouvertes ou en négociation" />
              <KpiCard label="Devis en attente" value={formatCount(data.kpis.pending_quotes)} hint="Envoyés ou en négociation" />
              <KpiCard label="Fournisseurs favoris" value={formatCount(data.kpis.favorite_suppliers)} />
            </div>
          </section>

          <section className="card" aria-labelledby="activity-chart-title">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <h2 id="activity-chart-title" className="text-base font-semibold text-ink">
                Activité des commandes
              </h2>
              <p className="text-xs text-muted">Commandes et dépenses par jour</p>
            </div>
            {data.series?.length ? (
              <TimeSeriesChart
                data={data.series}
                lines={CHART_LINES}
                allowDecimals
                ariaLabel="Évolution des commandes et des dépenses sur la période"
              />
            ) : (
              <div className="mt-4">
                <EmptyState title="Aucune donnée sur cette période" description="Choisissez une autre période." />
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section className="card" aria-labelledby="requests-title">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 id="requests-title" className="text-base font-semibold text-ink">
                    Demandes publiées
                  </h2>
                  <p className="mt-1 text-sm text-muted">Devis reçus, statut et échéance</p>
                </div>
                <Link to={PATHS.buyerTenders} className="text-sm font-medium text-brand-600 hover:underline">
                  Tout voir
                </Link>
              </div>

              {requests.length ? (
                <ul className="mt-4 divide-y divide-line">
                  {requests.map((tender) => (
                    <li key={tender.id} className="py-3">
                      <Link to={buyerTenderPath(tender.id)} className="flex flex-col gap-1 hover:text-brand-600">
                        <span className="font-medium text-ink">{tender.title}</span>
                        <span className="text-xs text-muted">
                          {plural(tender.quotes_received, 'devis reçu')} · échéance {formatDate(tender.desired_deadline)} ·
                          budget {tender.budget !== null ? formatAmount(tender.budget) : 'libre'}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-4">
                  <EmptyState title="Aucune demande ouverte" description="Publiez une demande pour recevoir des devis." />
                </div>
              )}
            </section>

            <section className="card" aria-labelledby="pending-quotes-title">
              <h2 id="pending-quotes-title" className="text-base font-semibold text-ink">
                Devis en attente de décision
              </h2>
              {pendingQuotes.length ? (
                <ul className="mt-4 divide-y divide-line">
                  {pendingQuotes.map((quote) => (
                    <li key={quote.id} className="flex items-start justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{quote.supplier ?? 'Fournisseur'}</p>
                        <p className="truncate text-xs text-muted">{quote.tender}</p>
                        <p className="mt-1 text-xs text-muted">
                          Délai {quote.delivery_days} jours
                          {quote.supplier_rating !== null && ` · note ${quote.supplier_rating}/5`}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-ink">{formatAmount(quote.amount)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-4">
                  <EmptyState title="Aucun devis en attente" description="Les nouveaux devis apparaîtront ici." />
                </div>
              )}
            </section>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section className="card" aria-labelledby="favorites-title">
              <div className="flex items-start justify-between gap-3">
                <h2 id="favorites-title" className="text-base font-semibold text-ink">
                  Fournisseurs favoris
                </h2>
                <Link to={PATHS.buyerFavorites} className="text-sm font-medium text-brand-600 hover:underline">
                  Gérer
                </Link>
              </div>
              {favorites.length ? (
                <ul className="mt-4 space-y-2">
                  {favorites.map((supplier) => (
                    <li key={supplier.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-ink">{supplier.company_name}</span>
                      <span className="text-muted">{supplier.rating_avg !== null ? `${supplier.rating_avg}/5` : '—'}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-4">
                  <EmptyState title="Aucun favori" description="Ajoutez des fournisseurs de confiance depuis le catalogue." />
                </div>
              )}
            </section>

            <section className="card" aria-labelledby="latest-orders-title">
              <div className="flex items-start justify-between gap-3">
                <h2 id="latest-orders-title" className="text-base font-semibold text-ink">
                  Dernières commandes
                </h2>
                <Link to={PATHS.buyerOrders} className="text-sm font-medium text-brand-600 hover:underline">
                  Tout voir
                </Link>
              </div>
              {orders.length ? (
                <ul className="mt-4 divide-y divide-line">
                  {orders.map((order) => (
                    <li key={order.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                      <div>
                        <p className="font-medium text-ink">Commande #{order.id}</p>
                        <p className="text-xs text-muted">
                          {order.supplier ?? 'Fournisseur'} · {order.status}
                        </p>
                      </div>
                      <span className="shrink-0 font-semibold text-ink">{formatAmount(order.total)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-4">
                  <EmptyState title="Aucune commande" description="Vos commandes apparaîtront ici." />
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  )
}
