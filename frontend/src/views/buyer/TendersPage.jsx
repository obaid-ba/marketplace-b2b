import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { fetchBuyerTenders } from '@/api/tenders'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/dashboard/EmptyState'
import { TenderStatusBadge } from '@/components/TenderBadges'
import { buyerTenderPath, buyerTenderQuotesPath, PATHS } from '@/router/paths'
import { formatAmount } from '@/utils/money'
import { formatDate } from '@/utils/period'

const STATUS_FILTERS = [
  { value: '', label: 'Toutes' },
  { value: 'ouverte', label: 'Ouvertes' },
  { value: 'en négociation', label: 'En négociation' },
  { value: 'clôturée', label: 'Clôturées' },
  { value: 'annulée', label: 'Annulées' },
]

/**
 * Liste des demandes publiées par le porteur (SCRUM-43 / F11) :
 * statut, nombre de fournisseurs touchés et de devis reçus.
 */
export default function TendersPage() {
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setResult(
        await fetchBuyerTenders({
          page,
          per_page: 10,
          ...(status ? { status } : {}),
        }),
      )
    } catch (failure) {
      setError(failure.userMessage ?? 'Impossible de charger vos demandes.')
    } finally {
      setLoading(false)
    }
  }, [page, status])

  useEffect(() => {
    load()
  }, [load])

  const tenders = result?.data ?? []
  const meta = result?.meta

  return (
    <>
      <PageHeader
        title="Mes demandes"
        subtitle="Suivez les demandes publiées et les devis reçus."
        actions={
          <Link to={PATHS.buyerTenderNew} className="btn-primary">
            Publier une demande
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => {
              setStatus(filter.value)
              setPage(1)
            }}
            className={
              status === filter.value
                ? 'rounded-full bg-brand-600 px-4 py-1.5 text-sm font-medium text-white'
                : 'rounded-full border border-line bg-surface px-4 py-1.5 text-sm text-muted hover:text-ink'
            }
          >
            {filter.label}
          </button>
        ))}
      </div>

      {loading && <div className="card text-sm text-muted">Chargement de vos demandes…</div>}

      {!loading && error && (
        <div className="card border-danger-soft bg-danger-soft/40 text-sm text-danger">
          {error}
          <button type="button" className="btn-secondary ml-4" onClick={load}>
            Réessayer
          </button>
        </div>
      )}

      {!loading && !error && tenders.length === 0 && (
        <EmptyState
          title="Aucune demande pour le moment"
          description="Publiez votre premier besoin : les fournisseurs validés de la catégorie seront notifiés."
          action={
            <Link to={PATHS.buyerTenderNew} className="btn-primary">
              Publier une demande
            </Link>
          }
        />
      )}

      {!loading && !error && tenders.length > 0 && (
        <ul className="space-y-3">
          {tenders.map((tender) => (
            <li key={tender.id} className="card">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={buyerTenderPath(tender.id)}
                      className="text-[17px] font-semibold text-ink hover:text-brand-600"
                    >
                      {tender.title}
                    </Link>
                    <TenderStatusBadge status={tender.status} label={tender.status_label} />
                  </div>

                  <p className="mt-1 line-clamp-2 text-sm text-muted">{tender.description}</p>

                  <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
                    <div className="flex gap-1">
                      <dt>Catégorie :</dt>
                      <dd className="text-ink">{tender.category?.name ?? '—'}</dd>
                    </div>
                    <div className="flex gap-1">
                      <dt>Région :</dt>
                      <dd className="text-ink">{tender.region?.name ?? 'Nationale'}</dd>
                    </div>
                    <div className="flex gap-1">
                      <dt>Budget :</dt>
                      <dd className="text-ink">
                        {tender.budget !== null ? formatAmount(tender.budget) : 'Non précisé'}
                      </dd>
                    </div>
                    <div className="flex gap-1">
                      <dt>Date limite :</dt>
                      <dd className="text-ink">
                        {tender.desired_deadline ? formatDate(tender.desired_deadline) : 'Non précisée'}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="flex shrink-0 gap-6 sm:text-right">
                  <div>
                    <p className="text-xl font-semibold text-ink">{tender.notified_count ?? 0}</p>
                    <p className="text-xs text-muted">fournisseurs notifiés</p>
                  </div>
                  <div>
                    <p className="text-xl font-semibold text-ink">{tender.quotes_count ?? 0}</p>
                    <p className="text-xs text-muted">devis reçus</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                <Link to={buyerTenderPath(tender.id)} className="btn-secondary">
                  Voir le détail
                </Link>
                {(tender.quotes_count ?? 0) > 0 && (
                  <Link to={buyerTenderQuotesPath(tender.id)} className="btn-primary">
                    Comparer les devis
                  </Link>
                )}
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
