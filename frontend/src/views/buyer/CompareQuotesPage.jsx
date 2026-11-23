import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { acceptQuote, fetchTenderQuotes } from '@/api/buyerQuotes'
import { fetchBuyerTender } from '@/api/tenders'
import ContactButton from '@/components/ContactButton'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/dashboard/EmptyState'
import { QuoteStatusBadge, TenderStatusBadge } from '@/components/TenderBadges'
import { buyerOrderPath, buyerTenderPath, PATHS } from '@/router/paths'
import { formatAmount } from '@/utils/money'
import { formatDate } from '@/utils/period'

const SORTS = [
  { value: 'amount', label: 'Prix croissant' },
  { value: 'delivery', label: 'Délai le plus court' },
  { value: 'rating', label: 'Meilleure note' },
]

function Stars({ rating, count }) {
  if (!rating) return <span className="text-sm text-muted">Pas encore noté</span>

  return (
    <span className="text-sm text-ink">
      <span aria-hidden="true">★</span> {Number(rating).toFixed(1)} / 5
      <span className="text-muted"> ({count} avis)</span>
    </span>
  )
}

/**
 * Comparaison des devis reçus puis acceptation (SCRUM-47, SCRUM-48 / F14).
 * L'acceptation crée la commande, refuse les autres devis et clôt la demande.
 */
export default function CompareQuotesPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [tender, setTender] = useState(null)
  const [quotes, setQuotes] = useState([])
  const [sort, setSort] = useState('amount')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [accepting, setAccepting] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [detail, list] = await Promise.all([
        fetchBuyerTender(id),
        fetchTenderQuotes(id, { sort, direction: sort === 'rating' ? 'desc' : 'asc' }),
      ])
      setTender(detail)
      setQuotes(Array.isArray(list) ? list : (list.data ?? []))
    } catch (failure) {
      setError(failure.userMessage ?? 'Impossible de charger les devis.')
    } finally {
      setLoading(false)
    }
  }, [id, sort])

  useEffect(() => {
    load()
  }, [load])

  async function handleAccept(quote) {
    const label = quote.supplier?.company_name ?? 'ce fournisseur'
    const confirmed = window.confirm(
      `Accepter le devis de ${label} pour ${formatAmount(quote.amount)} ?\n\n` +
        'La commande sera créée, les autres devis seront refusés et la demande clôturée.',
    )
    if (!confirmed) return

    setAccepting(quote.id)
    setError(null)
    try {
      const order = await acceptQuote(quote.id)
      navigate(buyerOrderPath(order.id), {
        state: { notice: 'Devis accepté : la commande a été créée.' },
      })
    } catch (failure) {
      setError(failure.userMessage ?? 'L’acceptation du devis a échoué.')
      await load()
    } finally {
      setAccepting(null)
    }
  }

  if (loading && !tender) return <div className="card text-sm text-muted">Chargement des devis…</div>

  if (!tender) {
    return (
      <div className="card border-danger-soft bg-danger-soft/40 text-sm text-danger">
        {error ?? 'Demande introuvable.'}
        <Link to={PATHS.buyerTenders} className="btn-secondary ml-4">
          Mes demandes
        </Link>
      </div>
    )
  }

  const isOpen = ['ouverte', 'en négociation'].includes(tender.status)
  const lowest = quotes.reduce(
    (min, quote) => (min === null || Number(quote.amount) < min ? Number(quote.amount) : min),
    null,
  )

  return (
    <>
      <PageHeader
        title="Comparer les devis"
        subtitle={tender.title}
        actions={
          <Link to={buyerTenderPath(tender.id)} className="btn-secondary">
            Retour à la demande
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <TenderStatusBadge status={tender.status} label={tender.status_label} />
        <span className="text-sm text-muted">
          {quotes.length} devis reçu{quotes.length > 1 ? 's' : ''}
        </span>

        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          Trier par
          <select className="input w-auto" value={sort} onChange={(event) => setSort(event.target.value)}>
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-danger-soft bg-danger-soft/50 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {!isOpen && (
        <div className="mb-4 rounded-lg border border-line bg-page px-4 py-3 text-sm text-muted">
          Cette demande est {tender.status_label?.toLowerCase() ?? 'clôturée'} : les devis ne sont plus modifiables.
        </div>
      )}

      {quotes.length === 0 ? (
        <EmptyState
          title="Aucun devis pour le moment"
          description="Les fournisseurs notifiés peuvent envoyer leur proposition depuis leur espace."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {quotes.map((quote) => {
            const bestPrice = lowest !== null && Number(quote.amount) === lowest
            const canAccept = isOpen && ['envoyé', 'en négociation'].includes(quote.status)

            return (
              <article
                key={quote.id}
                className={`card flex flex-col ${bestPrice ? 'border-success ring-1 ring-success/30' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-[17px] font-semibold text-ink">
                      {quote.supplier?.company_name ?? 'Fournisseur'}
                    </h2>
                    <p className="mt-0.5 text-xs text-muted">
                      {quote.supplier?.region?.name ?? 'Région non renseignée'}
                    </p>
                  </div>
                  <QuoteStatusBadge status={quote.status} label={quote.status_label} />
                </div>

                <p className="mt-4 text-2xl font-semibold text-ink">{formatAmount(quote.amount)}</p>
                <p className="text-sm text-muted">
                  Délai proposé : <span className="text-ink">{quote.delivery_days} jour(s)</span>
                </p>

                <div className="mt-2">
                  <Stars rating={quote.supplier?.rating_avg} count={quote.supplier?.reviews_count ?? 0} />
                </div>

                {bestPrice && (
                  <p className="mt-3 inline-flex w-fit rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success">
                    Meilleur prix
                  </p>
                )}

                {quote.conditions && (
                  <div className="mt-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Conditions</h3>
                    <p className="mt-1 whitespace-pre-line text-sm text-muted">{quote.conditions}</p>
                  </div>
                )}

                {quote.comment && (
                  <div className="mt-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Message</h3>
                    <p className="mt-1 whitespace-pre-line text-sm text-muted">{quote.comment}</p>
                  </div>
                )}

                <p className="mt-4 text-xs text-muted">
                  Reçu le {formatDate(quote.created_at?.slice(0, 10))}
                </p>

                <div className="mt-auto space-y-2 pt-4">
                  <ContactButton contextType="devis" contextId={quote.id} label="Discuter de ce devis" className="btn-secondary" />
                  {canAccept ? (
                    <button
                      type="button"
                      className="btn-primary w-full"
                      disabled={accepting !== null}
                      onClick={() => handleAccept(quote)}
                    >
                      {accepting === quote.id ? 'Acceptation…' : 'Accepter ce devis'}
                    </button>
                  ) : (
                    <p className="rounded-lg bg-page px-3 py-2 text-center text-xs text-muted">
                      {quote.status === 'accepté'
                        ? 'Devis retenu'
                        : quote.status === 'refusé'
                          ? 'Devis non retenu'
                          : 'Demande clôturée'}
                    </p>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </>
  )
}
