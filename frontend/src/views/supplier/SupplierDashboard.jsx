import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { fetchSupplierDashboard } from '@/api/supplierDashboard'
import ActivityAreaChart from '@/components/dashboard/ActivityAreaChart'
import ColorKpiCard from '@/components/dashboard/ColorKpiCard'
import DashboardPeriod from '@/components/dashboard/DashboardPeriod'
import EmptyState from '@/components/dashboard/EmptyState'
import ErrorState from '@/components/dashboard/ErrorState'
import Skeleton from '@/components/dashboard/Skeleton'
import WelcomeBanner from '@/components/dashboard/WelcomeBanner'
import { PATHS, productDetailPath, supplierTenderPath } from '@/router/paths'
import { selectUser, useAuthStore } from '@/stores/auth'
import { formatAmount, formatCount } from '@/utils/money'
import { defaultPeriod, formatDate } from '@/utils/period'

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

function Stars({ rating }) {
  return (
    <span aria-label={`Note ${rating} sur 5`} className="text-amber-400">
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} aria-hidden="true">
          {rating >= star ? '★' : '☆'}
        </span>
      ))}
    </span>
  )
}

/**
 * Tableau de bord fournisseur (SCRUM-120 / F26) : revenu, commandes, taux de
 * devis acceptés, produits les plus vus/vendus, demandes reçues et derniers avis.
 */
export default function SupplierDashboard() {
  const user = useAuthStore(selectUser)
  const [period, setPeriod] = useState(() => defaultPeriod())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async (range) => {
    setLoading(true)
    setError(null)
    try {
      setData(await fetchSupplierDashboard(range))
    } catch (requestError) {
      setError(requestError.userMessage ?? 'Impossible de charger le tableau de bord. Réessayez.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(period)
  }, [load, period])

  const viewed = data?.most_viewed_products ?? []
  const sold = data?.most_sold_products ?? []
  const requests = data?.open_requests ?? []
  const reviews = data?.latest_reviews ?? []
  const notifications = data?.latest_notifications ?? []
  const alert = data?.negative_review_alert
  const revenueTrend = data?.series?.map((day) => Number(day.revenue) || 0)
  const ordersTrend = data?.series?.map((day) => Number(day.orders) || 0)

  return (
    <div className="space-y-6">
      <WelcomeBanner
        name={user?.name ?? ''}
        subtitle="Voici l'activité de votre entreprise : revenus, commandes, produits et demandes reçues."
      />

      {alert?.active && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <p className="font-semibold">
            {plural(alert.count, 'avis négatif publié')} sur la période (note ≤ 2/5).
          </p>
          <p className="mt-1">
            Répondez aux avis pour rétablir la confiance, ou consultez{' '}
            <Link to={PATHS.supplierReviews} className="font-medium underline">
              vos avis
            </Link>
            .
          </p>
        </div>
      )}

      <DashboardPeriod period={period} onChange={setPeriod} loading={loading} />

      {error && !data && <ErrorState message={error} onRetry={() => load(period)} />}

      {loading && !data && <DashboardSkeleton />}

      {data && (
        <>
          <section aria-label="Indicateurs clés">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <ColorKpiCard
                label="Revenu"
                value={formatAmount(data.kpis.revenue)}
                hint="Commandes clôturées sur la période"
                icon="cart"
                tone="violet"
                trend={revenueTrend}
              />
              <ColorKpiCard
                label="Commandes"
                value={formatCount(data.kpis.orders_count)}
                hint={`${formatCount(data.kpis.orders_in_progress)} en cours · ${formatCount(
                  data.kpis.orders_finished,
                )} terminées`}
                icon="box"
                tone="green"
                trend={ordersTrend}
              />
              <ColorKpiCard
                label="Devis acceptés"
                value={`${formatCount(data.kpis.accepted_quote_rate)} %`}
                hint={`${formatCount(data.kpis.quotes_count)} devis déposés`}
                icon="target"
                tone="orange"
              />
              <ColorKpiCard
                label="Note moyenne"
                value={data.kpis.average_rating !== null ? `${data.kpis.average_rating} / 5` : '—'}
                hint={`${formatCount(data.kpis.reviews_count)} avis publiés`}
                icon="star"
                tone="mint"
              />
              <ColorKpiCard
                label="Vues produits"
                value={formatCount(data.kpis.views_count)}
                hint="Consultations de vos fiches sur la période"
                icon="eye"
                tone="blue"
              />
              <ColorKpiCard
                label="Notifications"
                value={formatCount(data.kpis.unread_items)}
                hint={`Non lues · ${plural(data.kpis.unread_messages ?? 0, 'message non lu', 'messages non lus')}`}
                icon="bell"
                tone="pink"
              />
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm" aria-labelledby="activity-chart-title">
            <div className="flex items-center justify-between gap-3">
              <h2 id="activity-chart-title" className="flex items-center gap-2 text-base font-semibold text-ink">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5 text-brand-600" aria-hidden="true">
                  <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
                </svg>
                Activité des commandes
              </h2>
              <Link to={PATHS.supplierOrders} className="text-sm font-medium text-brand-600 hover:underline">
                Voir tout →
              </Link>
            </div>
            {data.series?.length ? (
              <ActivityAreaChart
                series={data.series}
                valueKey="revenue"
                ariaLabel="Évolution des commandes et du revenu sur la période"
              />
            ) : (
              <div className="mt-4">
                <EmptyState title="Aucune donnée sur cette période" description="Choisissez une autre période." />
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section className="card" aria-labelledby="most-viewed-title">
              <h2 id="most-viewed-title" className="text-base font-semibold text-ink">
                Produits les plus consultés
              </h2>
              {viewed.length ? (
                <ul className="mt-4 divide-y divide-line">
                  {viewed.map((product) => (
                    <li key={product.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                      <Link to={productDetailPath(product.id)} className="min-w-0 truncate font-medium text-ink hover:text-brand-600">
                        {product.title}
                      </Link>
                      <span className="shrink-0 text-muted">{plural(product.views_count, 'vue')}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-4">
                  <EmptyState title="Aucune consultation" description="Publiez vos fiches pour être visible." />
                </div>
              )}
            </section>

            <section className="card" aria-labelledby="most-sold-title">
              <h2 id="most-sold-title" className="text-base font-semibold text-ink">
                Produits les plus vendus
              </h2>
              {sold.length ? (
                <ul className="mt-4 divide-y divide-line">
                  {sold.map((product) => (
                    <li key={`${product.id ?? 'free'}-${product.title}`} className="flex items-center justify-between gap-3 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{product.title}</p>
                        <p className="text-xs text-muted">{plural(product.quantity_sold, 'unité vendue', 'unités vendues')}</p>
                      </div>
                      <span className="shrink-0 font-semibold text-ink">{formatAmount(product.revenue)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-4">
                  <EmptyState title="Aucune vente" description="Vos meilleures ventes apparaîtront ici." />
                </div>
              )}
            </section>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section className="card" aria-labelledby="open-requests-title">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 id="open-requests-title" className="text-base font-semibold text-ink">
                    Demandes à traiter
                  </h2>
                  <p className="mt-1 text-sm text-muted">Classées par pertinence</p>
                </div>
                <Link to={PATHS.supplierTenders} className="text-sm font-medium text-brand-600 hover:underline">
                  Tout voir
                </Link>
              </div>
              {requests.length ? (
                <ul className="mt-4 divide-y divide-line">
                  {requests.map((request) => (
                    <li key={request.id} className="py-3">
                      <Link to={supplierTenderPath(request.id)} className="flex flex-col gap-1 hover:text-brand-600">
                        <span className="font-medium text-ink">{request.title}</span>
                        <span className="text-xs text-muted">
                          {request.score !== null ? `Pertinence ${request.score} % · ` : ''}
                          échéance {formatDate(request.desired_deadline)} · budget{' '}
                          {request.budget !== null ? formatAmount(request.budget) : 'libre'}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-4">
                  <EmptyState title="Aucune demande ouverte" description="Les nouvelles demandes apparaîtront ici." />
                </div>
              )}
            </section>

            <section className="card" aria-labelledby="latest-reviews-title">
              <div className="flex items-start justify-between gap-3">
                <h2 id="latest-reviews-title" className="text-base font-semibold text-ink">
                  Derniers avis
                </h2>
                <Link to={PATHS.supplierReviews} className="text-sm font-medium text-brand-600 hover:underline">
                  Tout voir
                </Link>
              </div>
              {reviews.length ? (
                <ul className="mt-4 divide-y divide-line">
                  {reviews.map((review) => (
                    <li key={review.id} className="py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-ink">{review.author}</span>
                        <Stars rating={review.rating} />
                      </div>
                      {review.comment && <p className="mt-1 line-clamp-2 text-sm text-muted">« {review.comment} »</p>}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-4">
                  <EmptyState title="Aucun avis publié" description="Les avis de vos acheteurs apparaîtront ici." />
                </div>
              )}
            </section>
          </div>

          <section className="card" aria-labelledby="latest-notifications-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 id="latest-notifications-title" className="text-base font-semibold text-ink">
                Dernières notifications
              </h2>
              <div className="flex gap-4 text-sm font-medium text-brand-600">
                <Link to={PATHS.supplierMessages} className="hover:underline">
                  Messagerie
                </Link>
                <Link to={PATHS.supplierNotifications} className="hover:underline">
                  Tout voir
                </Link>
              </div>
            </div>
            {notifications.length ? (
              <ul className="mt-4 divide-y divide-line">
                {notifications.map((notification) => (
                  <li key={notification.id} className="py-3 text-sm">
                    <Link to={notification.url ?? PATHS.supplierNotifications} className="block hover:text-brand-600">
                      <span className={notification.read_at ? 'text-ink' : 'font-medium text-ink'}>{notification.title}</span>
                      {notification.message && <span className="block truncate text-xs text-muted">{notification.message}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-4">
                <EmptyState title="Aucune notification" description="Vos alertes apparaîtront ici." />
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
