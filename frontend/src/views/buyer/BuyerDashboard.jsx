import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { fetchBuyerOrders } from '@/api/orders'
import { fetchBuyerTenders } from '@/api/tenders'
import PageHeader from '@/components/PageHeader'
import { TenderStatusBadge } from '@/components/TenderBadges'
import { buyerTenderPath, PATHS } from '@/router/paths'
import { selectUser, useAuthStore } from '@/stores/auth'
import { formatAmount } from '@/utils/money'

/**
 * Tableau de bord du porteur de projet : accès direct aux demandes,
 * à la publication et aux commandes nées d'un devis accepté (F11–F14).
 */
export default function BuyerDashboard() {
  const user = useAuthStore(selectUser)
  const [stats, setStats] = useState({ tenders: null, orders: null })
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    Promise.all([
      fetchBuyerTenders({ per_page: 5 }).catch(() => null),
      fetchBuyerOrders({ per_page: 1 }).catch(() => null),
    ])
      .then(([tenders, orders]) => {
        if (!active) return
        setStats({
          tenders: tenders?.meta?.total ?? 0,
          orders: orders?.meta?.total ?? 0,
        })
        setRecent(tenders?.data ?? [])
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const openTenders = recent.filter((tender) => ['ouverte', 'en négociation'].includes(tender.status))
  const quotesReceived = recent.reduce((sum, tender) => sum + (tender.quotes_count ?? 0), 0)

  return (
    <>
      <PageHeader
        title={`Bonjour ${user?.name ?? ''}`}
        subtitle="Publiez vos besoins, comparez les devis et suivez vos commandes."
        actions={
          <Link to={PATHS.buyerTenderNew} className="btn-primary">
            Publier une demande
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link to={PATHS.buyerTenders} className="card transition hover:border-brand-100 hover:shadow-md">
          <p className="text-sm text-muted">Demandes publiées</p>
          <p className="mt-1 text-3xl font-semibold text-ink">
            {loading ? '—' : (stats.tenders ?? 0)}
          </p>
        </Link>

        <div className="card">
          <p className="text-sm text-muted">Demandes ouvertes (5 dernières)</p>
          <p className="mt-1 text-3xl font-semibold text-ink">{loading ? '—' : openTenders.length}</p>
        </div>

        <div className="card">
          <p className="text-sm text-muted">Devis reçus (5 dernières)</p>
          <p className="mt-1 text-3xl font-semibold text-ink">{loading ? '—' : quotesReceived}</p>
        </div>

        <Link to={PATHS.buyerOrders} className="card transition hover:border-brand-100 hover:shadow-md">
          <p className="text-sm text-muted">Commandes</p>
          <p className="mt-1 text-3xl font-semibold text-ink">
            {loading ? '—' : (stats.orders ?? 0)}
          </p>
        </Link>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Link
          to={PATHS.buyerTenderNew}
          className="card border-brand-100 bg-brand-50/50 transition hover:shadow-md"
        >
          <p className="text-base font-semibold text-brand-700">Publier une demande</p>
          <p className="mt-1 text-sm text-muted">
            Décrivez votre besoin : les fournisseurs de la bonne catégorie et région sont notifiés.
          </p>
        </Link>

        <Link to={PATHS.buyerTenders} className="card transition hover:border-brand-100 hover:shadow-md">
          <p className="text-base font-semibold text-ink">Comparer les devis</p>
          <p className="mt-1 text-sm text-muted">
            Prix, délai et note fournisseur, puis acceptation en un clic.
          </p>
        </Link>

        <Link to={PATHS.buyerOrders} className="card transition hover:border-brand-100 hover:shadow-md">
          <p className="text-base font-semibold text-ink">Suivre mes commandes</p>
          <p className="mt-1 text-sm text-muted">
            Chaque devis accepté crée une commande, sans paiement en ligne.
          </p>
        </Link>
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Dernières demandes</h2>
          <Link to={PATHS.buyerTenders} className="text-sm font-medium text-brand-600 hover:underline">
            Tout voir
          </Link>
        </div>

        {loading && <div className="card text-sm text-muted">Chargement…</div>}

        {!loading && recent.length === 0 && (
          <div className="card text-sm text-muted">
            Aucune demande publiée pour le moment.{' '}
            <Link to={PATHS.buyerTenderNew} className="font-medium text-brand-600 hover:underline">
              Publier la première
            </Link>
            .
          </div>
        )}

        {!loading && recent.length > 0 && (
          <ul className="space-y-2">
            {recent.map((tender) => (
              <li key={tender.id}>
                <Link
                  to={buyerTenderPath(tender.id)}
                  className="flex flex-col gap-2 rounded-xl border border-line bg-surface px-4 py-3 transition hover:border-brand-100 hover:bg-brand-50/30 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium text-ink">{tender.title}</span>
                    <TenderStatusBadge status={tender.status} label={tender.status_label} />
                  </span>
                  <span className="flex shrink-0 items-center gap-4 text-xs text-muted">
                    <span>
                      {tender.quotes_count ?? 0} devis · {tender.notified_count ?? 0} fournisseurs
                    </span>
                    <span className="font-medium text-ink">
                      {tender.budget !== null ? formatAmount(tender.budget) : 'Budget libre'}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
