import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { fetchSupplierQuotes } from '@/api/supplierTenders'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/dashboard/EmptyState'
import { QuoteStatusBadge } from '@/components/TenderBadges'
import { PATHS, supplierTenderPath } from '@/router/paths'
import { formatAmount } from '@/utils/money'
import { formatDate } from '@/utils/period'

const STATUS_FILTERS = [
  { value: '', label: 'Tous' },
  { value: 'envoyé', label: 'Envoyés' },
  { value: 'en négociation', label: 'En négociation' },
  { value: 'accepté', label: 'Acceptés' },
  { value: 'refusé', label: 'Refusés' },
]

/**
 * Devis envoyés par le fournisseur et leur statut (SCRUM-46 / F13).
 */
export default function MyQuotesPage() {
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
        await fetchSupplierQuotes({
          page,
          per_page: 10,
          ...(status ? { status } : {}),
        }),
      )
    } catch (failure) {
      setError(failure.userMessage ?? 'Impossible de charger vos devis.')
    } finally {
      setLoading(false)
    }
  }, [page, status])

  useEffect(() => {
    load()
  }, [load])

  const quotes = result?.data ?? []
  const meta = result?.meta

  return (
    <>
      <PageHeader
        title="Mes devis"
        subtitle="Suivez les devis envoyés et leur décision."
        actions={
          <Link to={PATHS.supplierTenders} className="btn-secondary">
            Demandes reçues
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

      {loading && <div className="card text-sm text-muted">Chargement de vos devis…</div>}

      {!loading && error && (
        <div className="card border-danger-soft bg-danger-soft/40 text-sm text-danger">
          {error}
          <button type="button" className="btn-secondary ml-4" onClick={load}>
            Réessayer
          </button>
        </div>
      )}

      {!loading && !error && quotes.length === 0 && (
        <EmptyState
          title="Aucun devis"
          description="Répondez à une demande reçue pour envoyer votre premier devis."
          action={
            <Link to={PATHS.supplierTenders} className="btn-primary">
              Voir les demandes reçues
            </Link>
          }
        />
      )}

      {!loading && !error && quotes.length > 0 && (
        <ul className="space-y-3">
          {quotes.map((quote) => (
            <li key={quote.id} className="card">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={supplierTenderPath(quote.tender?.id)}
                      className="text-[17px] font-semibold text-ink hover:text-brand-600"
                    >
                      {quote.tender?.title ?? 'Demande supprimée'}
                    </Link>
                    <QuoteStatusBadge status={quote.status} label={quote.status_label} />
                  </div>

                  <p className="mt-1 text-sm text-muted">
                    {quote.tender?.category?.name ?? 'Catégorie non précisée'} ·{' '}
                    {quote.tender?.region?.name ?? 'Toute la Tunisie'} · envoyé le{' '}
                    {formatDate(quote.updated_at?.slice(0, 10) ?? quote.created_at?.slice(0, 10))}
                  </p>
                </div>

                <div className="flex items-center gap-4 sm:flex-col sm:items-end">
                  <div className="text-right">
                    <p className="text-xl font-semibold text-ink">{formatAmount(quote.amount)}</p>
                    <p className="text-xs text-muted">{quote.delivery_days} jour(s)</p>
                  </div>
                  <Link to={supplierTenderPath(quote.tender?.id)} className="btn-secondary">
                    {quote.can_edit ? 'Modifier' : 'Consulter'}
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
