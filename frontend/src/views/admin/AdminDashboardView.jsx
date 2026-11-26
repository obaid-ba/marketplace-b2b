import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/dashboard/EmptyState'
import ErrorState from '@/components/dashboard/ErrorState'
import KpiCard from '@/components/dashboard/KpiCard'
import PeriodPicker from '@/components/dashboard/PeriodPicker'
import Skeleton from '@/components/dashboard/Skeleton'
import TimeSeriesChart from '@/components/dashboard/TimeSeriesChart'
import { PATHS, adminDisputePath } from '@/router/paths'
import AdminExportDialog from './AdminExportDialog'
import AnomalyAlertsCard from './AnomalyAlertsCard'
import {
  selectAdminDashboard,
  selectAdminDashboardError,
  selectAdminDashboardLoading,
  useAdminDashboardStore,
} from '@/stores/adminDashboard'
import { formatAmount, formatCount } from '@/utils/money'
import { defaultPeriod, formatDate } from '@/utils/period'

const plural = (count, singular, pluralForm = `${singular}s`) =>
  `${count} ${count > 1 ? pluralForm : singular}`

function waitingLabel(days) {
  return days > 0 ? `En attente depuis ${plural(days, 'jour')}` : "Reçu aujourd'hui"
}

function DashboardSkeleton() {
  return (
    <div role="status" className="space-y-6" aria-busy="true" aria-label="Chargement du tableau de bord">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
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

function SectionHeader({ id, title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 id={id} className="text-base font-semibold text-ink">
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export default function AdminDashboardView() {
  const data = useAdminDashboardStore(selectAdminDashboard)
  const loading = useAdminDashboardStore(selectAdminDashboardLoading)
  const error = useAdminDashboardStore(selectAdminDashboardError)
  const load = useAdminDashboardStore((state) => state.load)
  const reset = useAdminDashboardStore((state) => state.reset)

  const [period, setPeriod] = useState(() => defaultPeriod())
  // /admin?exports=1 : lien de la notification « Export prêt ».
  const [params, setParams] = useSearchParams()
  const exportOpen = params.get('exports') === '1'
  const setExportOpen = (open) => setParams(open ? { exports: '1' } : {}, { replace: true })

  useEffect(() => {
    load(period)
  }, [load, period])

  useEffect(() => reset, [reset])

  const validationQueue = data?.validation_queue
  const disputes = data?.urgent_disputes
  const reported = data?.reported_reviews
  const categories = data?.top_categories ?? []
  const maxProducts = Math.max(1, ...categories.map((category) => category.products_count))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tableau de bord administrateur"
        subtitle="Vue consolidée de l'activité de la plateforme : comptes, commandes, demandes et files à traiter."
        actions={
          <button type="button" className="btn btn-secondary" onClick={() => setExportOpen(true)}>
            Exporter les statistiques
          </button>
        }
      />

      <AdminExportDialog open={exportOpen} defaultRange={period} onClose={() => setExportOpen(false)} />

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

      {error && data && (
        <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          L'actualisation a échoué : {error} Les chiffres affichés datent du dernier chargement réussi.
        </div>
      )}

      {loading && !data && <DashboardSkeleton />}

      {data && (
        <>
          <section aria-label="Indicateurs clés">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <KpiCard
                label="Utilisateurs actifs"
                value={formatCount(data.kpis.active_users)}
                hint="Connectés dans les 30 jours précédant la période"
              />
              <KpiCard
                label="Fournisseurs validés"
                value={formatCount(data.kpis.validated_suppliers)}
                hint="Comptes fournisseurs validés"
              />
              <KpiCard
                label="Commandes"
                value={formatCount(data.kpis.orders_count)}
                hint="Créées sur la période"
              />
              <KpiCard
                label="Revenu global"
                value={formatAmount(data.kpis.revenue)}
                hint="Commandes clôturées sur la période"
              />
              <KpiCard
                label="Demandes"
                value={formatCount(data.kpis.tenders_count)}
                hint="Demandes publiées sur la période"
              />
            </div>
            <p className="mt-2 text-xs text-muted">
              Indicateurs provisoires : les définitions des KPI (revenu, utilisateurs actifs) seront validées avec
              l'équipe.
            </p>
          </section>

          <section className="card" aria-labelledby="activity-chart-title">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <h2 id="activity-chart-title" className="text-base font-semibold text-ink">
                Évolution de l'activité
              </h2>
              <p className="text-xs text-muted">Inscriptions, commandes et demandes</p>
            </div>
            {data.series?.length ? (
              <TimeSeriesChart data={data.series} />
            ) : (
              <div className="mt-4">
                <EmptyState
                  title="Aucune donnée sur cette période"
                  description="Choisissez une autre période pour afficher la courbe."
                />
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section className="card" aria-labelledby="validation-queue-title">
              <SectionHeader
                id="validation-queue-title"
                title="Fournisseurs à valider"
                subtitle={`${plural(validationQueue?.count ?? 0, 'dossier')} en attente`}
                action={
                  <Link to={PATHS.adminSuppliers} className="btn btn-secondary shrink-0">
                    Ouvrir la file
                  </Link>
                }
              />

              {validationQueue?.items?.length ? (
                <ul className="mt-4 divide-y divide-line">
                  {validationQueue.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium text-ink">{item.company_name}</p>
                        <p className="text-xs text-muted">{waitingLabel(item.waiting_days)}</p>
                      </div>
                      <Link
                        to={PATHS.adminSuppliers}
                        className="text-sm font-medium text-brand-600 hover:text-brand-700"
                      >
                        Traiter le dossier
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-4">
                  <EmptyState
                    title="Aucun dossier en attente"
                    description="Tous les fournisseurs ont été traités."
                  />
                </div>
              )}
            </section>

            <section className="card" aria-labelledby="urgent-disputes-title">
              <SectionHeader
                id="urgent-disputes-title"
                title="Litiges urgents"
                subtitle={`${plural(disputes?.count ?? 0, 'litige ouvert')}`}
              />

              {disputes?.items?.length ? (
                <ul className="mt-4 divide-y divide-line">
                  {disputes.items.map((dispute) => (
                    <li key={dispute.id} className="py-3">
                      <Link to={adminDisputePath(dispute.id)} className="font-medium text-brand-600 hover:underline">
                        Commande #{dispute.order_id}
                      </Link>
                      <p className="text-sm text-muted">{dispute.reason}</p>
                      <p className="mt-1 text-xs text-muted">
                        Ouvert depuis {plural(dispute.age_days, 'jour')}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-4">
                  <EmptyState
                    title="Aucun litige ouvert"
                    description="Les litiges signalés par les porteurs apparaîtront ici."
                  />
                </div>
              )}
            </section>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <section className="card" aria-labelledby="reported-reviews-title">
              <SectionHeader
                id="reported-reviews-title"
                title="Avis signalés"
                subtitle={`${reported?.count ?? 0} avis à examiner`}
                action={
                  <Link to={PATHS.adminReviews} className="btn btn-secondary shrink-0">
                    Examiner
                  </Link>
                }
              />
              {reported?.items?.length ? (
                <ul className="mt-4 divide-y divide-line">
                  {reported.items.map((review) => (
                    <li key={review.id} className="py-3 text-sm">
                      <p className="font-medium text-ink">
                        {review.supplier ?? 'Fournisseur'} · {review.rating}/5
                      </p>
                      {review.comment && <p className="text-muted">« {review.comment} »</p>}
                      <p className="mt-1 text-xs text-muted">{plural(review.reports_count, 'signalement')}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-4">
                  <EmptyState title="Aucun avis signalé" description="Les signalements des fournisseurs apparaîtront ici." />
                </div>
              )}
            </section>

            <section className="card" aria-labelledby="top-categories-title">
              <SectionHeader
                id="top-categories-title"
                title="Catégories les plus actives"
                subtitle="Nombre de produits publiés"
              />

              {categories.length ? (
                <ul className="mt-4 space-y-3">
                  {categories.map((category, index) => (
                    <li key={category.id}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-ink">
                          {index + 1}. {category.name}
                        </span>
                        <span className="shrink-0 text-muted">
                          {plural(category.products_count, 'produit publié', 'produits publiés')}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-page" aria-hidden="true">
                        <div
                          className="h-full rounded-full bg-brand-600"
                          style={{ width: `${Math.round((category.products_count / maxProducts) * 100)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-4">
                  <EmptyState
                    title="Aucune catégorie active"
                    description="Les produits publiés alimenteront ce classement."
                  />
                </div>
              )}
            </section>

            {/* Comptes et commandes au comportement inhabituel (SCRUM-86) */}
            <AnomalyAlertsCard initialAlerts={data.anomaly_alerts ?? []} />
          </div>
        </>
      )}
    </div>
  )
}
