import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { fetchSupplierTenders } from '@/api/supplierTenders'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/dashboard/EmptyState'
import RelevanceScoreBadge from '@/components/RelevanceScoreBadge'
import { TenderStatusBadge } from '@/components/TenderBadges'
import { PATHS, supplierTenderPath } from '@/router/paths'
import { formatAmount } from '@/utils/money'
import { formatDate } from '@/utils/period'

const ANSWER_FILTERS = [
  { value: '', label: 'Toutes' },
  { value: 'no', label: 'À traiter' },
  { value: 'yes', label: 'Déjà répondues' },
]

/**
 * Demandes reçues par le fournisseur, classées par pertinence (SCRUM-44 / F13).
 * Le score vient de la diffusion automatique (catégorie, région, mots-clés).
 */
export default function ReceivedTendersPage() {
  const [filters, setFilters] = useState({ search: '', answered: '', sort: 'score' })
  const [page, setPage] = useState(1)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setResult(
        await fetchSupplierTenders({
          page,
          per_page: 10,
          sort: filters.sort,
          ...(filters.search ? { search: filters.search } : {}),
          ...(filters.answered ? { answered: filters.answered } : {}),
        }),
      )
    } catch (failure) {
      setError(failure.userMessage ?? 'Impossible de charger les demandes reçues.')
    } finally {
      setLoading(false)
    }
  }, [page, filters])

  useEffect(() => {
    load()
  }, [load])

  const recipients = result?.data ?? []
  const meta = result?.meta

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }))
    setPage(1)
  }

  return (
    <>
      <PageHeader
        title="Demandes reçues"
        subtitle="Les demandes sont classées par score de pertinence avec votre activité."
        actions={
          <Link to={PATHS.supplierQuotes} className="btn-secondary">
            Mes devis
          </Link>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="search"
          className="input sm:max-w-xs"
          placeholder="Rechercher un titre…"
          value={filters.search}
          onChange={(event) => updateFilter('search', event.target.value)}
          aria-label="Rechercher une demande"
        />

        <div className="flex flex-wrap gap-2">
          {ANSWER_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => updateFilter('answered', filter.value)}
              className={
                filters.answered === filter.value
                  ? 'rounded-full bg-brand-600 px-4 py-1.5 text-sm font-medium text-white'
                  : 'rounded-full border border-line bg-surface px-4 py-1.5 text-sm text-muted hover:text-ink'
              }
            >
              {filter.label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm text-muted sm:ml-auto">
          Trier par
          <select
            className="input w-auto"
            value={filters.sort}
            onChange={(event) => updateFilter('sort', event.target.value)}
          >
            <option value="score">Pertinence</option>
            <option value="recent">Plus récentes</option>
          </select>
        </label>
      </div>

      {loading && <div className="card text-sm text-muted">Chargement des demandes…</div>}

      {!loading && error && (
        <div className="card border-danger-soft bg-danger-soft/40 text-sm text-danger">
          {error}
          <button type="button" className="btn-secondary ml-4" onClick={load}>
            Réessayer
          </button>
        </div>
      )}

      {!loading && !error && recipients.length === 0 && (
        <EmptyState
          title="Aucune demande pour le moment"
          description="Vous serez notifié dès qu’une demande correspond à vos catégories et à votre région."
        />
      )}

      {!loading && !error && recipients.length > 0 && (
        <ul className="space-y-3">
          {recipients.map((recipient) => {
            const tender = recipient.tender
            if (!tender) return null

            return (
              <li key={recipient.recipient_id} className="card">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={supplierTenderPath(tender.id)}
                        className="text-[17px] font-semibold text-ink hover:text-brand-600"
                      >
                        {tender.title}
                      </Link>
                      <RelevanceScoreBadge score={recipient.score} />
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
                        <dt>Reçue le :</dt>
                        <dd className="text-ink">{formatDate(recipient.notified_at?.slice(0, 10))}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                    {recipient.already_responded ? (
                      <span className="rounded-full bg-success-soft px-3 py-1 text-xs font-medium text-success">
                        Devis envoyé
                      </span>
                    ) : (
                      <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
                        À traiter
                      </span>
                    )}

                    <Link to={supplierTenderPath(tender.id)} className="btn-primary">
                      {recipient.already_responded ? 'Modifier mon devis' : 'Répondre'}
                    </Link>
                  </div>
                </div>
              </li>
            )
          })}
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
