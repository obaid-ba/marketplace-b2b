import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import PageHeader from '@/components/PageHeader'
import RelevanceScoreBadge from '@/components/RelevanceScoreBadge'
import { fetchSupplierQuotes, fetchSupplierTenders } from '@/api/supplierTenders'
import { PATHS, supplierTenderPath } from '@/router/paths'
import { selectUser, useAuthStore } from '@/stores/auth'
import { formatAmount } from '@/utils/money'

/**
 * Tableau de bord fournisseur : demandes reçues classées par pertinence,
 * devis envoyés et accès direct aux pages du sprint (F13).
 */
export default function SupplierDashboard() {
  const user = useAuthStore(selectUser)
  const [stats, setStats] = useState({ received: null, todo: null, quotes: null, accepted: null })
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    Promise.all([
      fetchSupplierTenders({ per_page: 5 }).catch(() => null),
      fetchSupplierTenders({ per_page: 1, answered: 'no' }).catch(() => null),
      fetchSupplierQuotes({ per_page: 1 }).catch(() => null),
      fetchSupplierQuotes({ per_page: 1, status: 'accepté' }).catch(() => null),
    ])
      .then(([tenders, todo, quotes, accepted]) => {
        if (!active) return
        setStats({
          received: tenders?.meta?.total ?? 0,
          todo: todo?.meta?.total ?? 0,
          quotes: quotes?.meta?.total ?? 0,
          accepted: accepted?.meta?.total ?? 0,
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

  return (
    <>
      <PageHeader
        title={`Bonjour ${user?.name ?? ''}`}
        subtitle="Répondez aux demandes qui correspondent à votre activité et suivez vos devis."
        actions={
          <Link to={PATHS.supplierTenders} className="btn-primary">
            Voir les demandes reçues
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link to={PATHS.supplierTenders} className="card transition hover:border-brand-100 hover:shadow-md">
          <p className="text-sm text-muted">Demandes reçues</p>
          <p className="mt-1 text-3xl font-semibold text-ink">{loading ? '—' : (stats.received ?? 0)}</p>
        </Link>

        <Link
          to={PATHS.supplierTenders}
          className="card border-accent-soft bg-accent-soft/40 transition hover:shadow-md"
        >
          <p className="text-sm text-muted">À traiter</p>
          <p className="mt-1 text-3xl font-semibold text-accent">{loading ? '—' : (stats.todo ?? 0)}</p>
        </Link>

        <Link to={PATHS.supplierQuotes} className="card transition hover:border-brand-100 hover:shadow-md">
          <p className="text-sm text-muted">Devis envoyés</p>
          <p className="mt-1 text-3xl font-semibold text-ink">{loading ? '—' : (stats.quotes ?? 0)}</p>
        </Link>

        <Link to={PATHS.supplierQuotes} className="card transition hover:border-brand-100 hover:shadow-md">
          <p className="text-sm text-muted">Devis acceptés</p>
          <p className="mt-1 text-3xl font-semibold text-success">{loading ? '—' : (stats.accepted ?? 0)}</p>
        </Link>
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Demandes les plus pertinentes</h2>
          <Link to={PATHS.supplierTenders} className="text-sm font-medium text-brand-600 hover:underline">
            Tout voir
          </Link>
        </div>

        {loading && <div className="card text-sm text-muted">Chargement…</div>}

        {!loading && recent.length === 0 && (
          <div className="card text-sm text-muted">
            Aucune demande reçue pour le moment. Vous serez notifié dès qu’un besoin correspond à
            votre catégorie et à votre région.
          </div>
        )}

        {!loading && recent.length > 0 && (
          <ul className="space-y-2">
            {recent.map((recipient) => {
              const tender = recipient.tender
              if (!tender) return null

              return (
                <li key={recipient.recipient_id}>
                  <Link
                    to={supplierTenderPath(tender.id)}
                    className="flex flex-col gap-2 rounded-xl border border-line bg-surface px-4 py-3 transition hover:border-brand-100 hover:bg-brand-50/30 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium text-ink">{tender.title}</span>
                      <RelevanceScoreBadge score={recipient.score} />
                    </span>
                    <span className="flex shrink-0 items-center gap-4 text-xs text-muted">
                      <span>{tender.category?.name ?? 'Catégorie non précisée'}</span>
                      <span className="font-medium text-ink">
                        {tender.budget !== null ? formatAmount(tender.budget) : 'Budget libre'}
                      </span>
                      <span className={recipient.already_responded ? 'text-success' : 'text-accent'}>
                        {recipient.already_responded ? 'Devis envoyé' : 'À traiter'}
                      </span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}
