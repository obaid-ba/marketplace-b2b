import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { fetchBuyerDashboard } from '@/api/buyerDashboard'
import ActivityAreaChart from '@/components/dashboard/ActivityAreaChart'
import ColorKpiCard from '@/components/dashboard/ColorKpiCard'
import DashboardPeriod from '@/components/dashboard/DashboardPeriod'
import EmptyState from '@/components/dashboard/EmptyState'
import ErrorState from '@/components/dashboard/ErrorState'
import Skeleton from '@/components/dashboard/Skeleton'
import WelcomeBanner from '@/components/dashboard/WelcomeBanner'
import { OrderStatusBadge } from '@/components/orders/OrderStatusBadge'
import { TenderStatusBadge } from '@/components/TenderBadges'
import { PATHS, buyerTenderPath, buyerTenderQuotesPath, orderTrackingPath, supplierPublicPath } from '@/router/paths'
import { selectUser, useAuthStore } from '@/stores/auth'
import { formatAmount, formatCount } from '@/utils/money'
import { defaultPeriod, formatDate } from '@/utils/period'
import RecentActivity from './RecentActivity'
import RecommendedSuppliers from './RecommendedSuppliers'

const plural = (count, singular, pluralForm = `${singular}s`) =>
  `${count} ${count > 1 ? pluralForm : singular}`

function DashboardSkeleton() {
  return (
    <div role="status" className="space-y-6" aria-busy="true" aria-label="Chargement du tableau de bord">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-5">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-3 h-7 w-20" />
            </div>
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
  const spendingTrend = data?.series?.map((day) => Number(day.spending) || 0)
  const ordersTrend = data?.series?.map((day) => Number(day.orders) || 0)

  return (
    <div className="space-y-6">
      <WelcomeBanner name={user?.name ?? ''} subtitle="Gérez vos demandes, vos commandes et avancez sereinement." />

      <DashboardPeriod period={period} onChange={setPeriod} loading={loading} />

      {error && !data && <ErrorState message={error} onRetry={() => load(period)} />}

      {loading && !data && <DashboardSkeleton />}

      {data && (
        <>
          <section aria-label="Indicateurs clés">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <ColorKpiCard
                label="Dépenses"
                value={formatAmount(data.kpis.spending)}
                hint="Commandes passées sur la période"
                icon="cart"
                tone="violet"
                trend={spendingTrend}
              />
              <ColorKpiCard
                label="Commandes"
                value={formatCount(data.kpis.orders_count)}
                hint="Toutes commandes confondues"
                icon="box"
                tone="green"
                trend={ordersTrend}
              />
              <ColorKpiCard
                label="En cours"
                value={formatCount(data.kpis.orders_in_progress)}
                hint={`À suivre · ${formatCount(data.kpis.orders_closed)} terminées`}
                icon="target"
                tone="orange"
              />
              <ColorKpiCard
                label="Demandes publiées"
                value={formatCount(data.kpis.published_requests)}
                hint="Ouvertes ou en négociation"
                icon="megaphone"
                tone="blue"
              />
              <ColorKpiCard
                label="Devis en attente"
                value={formatCount(data.kpis.pending_quotes)}
                hint="En attente de votre réponse"
                icon="hourglass"
                tone="pink"
              />
              <ColorKpiCard
                label="Fournisseurs favoris"
                value={formatCount(data.kpis.favorite_suppliers)}
                hint="Vos partenaires de confiance"
                icon="star"
                tone="mint"
              />
            </div>
          </section>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
            <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm xl:col-span-3" aria-labelledby="activity-chart-title">
              <div className="flex items-center justify-between gap-3">
                <h2 id="activity-chart-title" className="flex items-center gap-2 text-base font-semibold text-ink">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5 text-brand-600" aria-hidden="true">
                    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
                  </svg>
                  Activité des commandes
                </h2>
                <Link to={PATHS.buyerOrders} className="text-sm font-medium text-brand-600 hover:underline">
                  Voir tout →
                </Link>
              </div>
              {data.series?.length ? (
                <ActivityAreaChart series={data.series} valueKey="spending" />
              ) : (
                <div className="mt-4">
                  <EmptyState title="Aucune donnée sur cette période" description="Choisissez une autre période." />
                </div>
              )}
            </section>

            <div className="xl:col-span-2">
              <RecentActivity orders={orders} quotes={pendingQuotes} requests={requests} allPath={PATHS.buyerOrders} />
            </div>
          </div>

          {/* Fournisseurs recommandés selon les achats passés (SCRUM-87) */}
          <RecommendedSuppliers />

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
                        <span className="flex flex-wrap items-center gap-2 font-medium text-ink">
                          {tender.title}
                          <TenderStatusBadge status={tender.status} label={tender.status_label} />
                        </span>
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
                        <Link to={buyerTenderQuotesPath(quote.tender_id)} className="block truncate font-medium text-ink hover:text-brand-600">
                          {quote.supplier ?? 'Fournisseur'}
                        </Link>
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
                      <Link to={supplierPublicPath(supplier.id)} className="font-medium text-ink hover:text-brand-600">
                        {supplier.company_name}
                      </Link>
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
                  Commandes en cours et récentes
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
                        <Link to={orderTrackingPath(order.id)} className="font-medium text-ink hover:text-brand-600">
                          Commande #{order.id}
                        </Link>
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                          {order.supplier ?? 'Fournisseur'} <OrderStatusBadge status={order.status} />
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
