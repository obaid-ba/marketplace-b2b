import { useCallback, useEffect, useState } from 'react'
import { fetchReportedReviews, hideReview, keepReview } from '@/api/adminModeration'
import Modal from '@/components/Modal'
import PageHeader from '@/components/PageHeader'
import Pagination from '@/components/Pagination'
import { formatDate } from '@/utils/period'

function authorName(review) {
  const user = review.buyer?.user
  if (!user) return 'Acheteur'
  return user.name || [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Acheteur'
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
 * Avis signalés (SCRUM-74 / F29) : la modération conserve ou masque l'avis.
 * Masquer recalcule la note du fournisseur et notifie l'auteur.
 */
export default function AdminReviewsPage() {
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  const [target, setTarget] = useState(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState(null)

  const load = useCallback(async (currentPage) => {
    setLoading(true)
    setError(null)
    try {
      setData(await fetchReportedReviews({ page: currentPage, per_page: 20 }))
    } catch (requestError) {
      setError(requestError.userMessage ?? 'Impossible de charger les avis signalés.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(page)
  }, [load, page])

  async function keep(review) {
    setActionError(null)
    setNotice(null)
    try {
      const result = await keepReview(review.id)
      setNotice(result?.message ?? "L'avis a été conservé.")
      await load(page)
    } catch (requestError) {
      setActionError(requestError.userMessage ?? "La décision n'a pas pu être enregistrée.")
    }
  }

  function openHide(review) {
    setTarget(review)
    setReason('')
    setActionError(null)
    setNotice(null)
  }

  async function submitHide(event) {
    event.preventDefault()
    setSubmitting(true)
    setActionError(null)
    try {
      const result = await hideReview(target.id, reason.trim() || null)
      setNotice(result?.message ?? "L'avis a été masqué.")
      setTarget(null)
      await load(page)
    } catch (requestError) {
      setActionError(requestError.userMessage ?? "L'avis n'a pas pu être masqué.")
    } finally {
      setSubmitting(false)
    }
  }

  const reviews = data?.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Avis signalés"
        subtitle="Examinez les signalements : conservez l'avis s'il est conforme, masquez-le sinon."
      />

      {notice && (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {notice}
        </p>
      )}
      {actionError && !target && (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {actionError}
        </p>
      )}

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          <p>{error}</p>
          <button type="button" className="btn btn-secondary mt-3" onClick={() => load(page)}>
            Réessayer
          </button>
        </div>
      )}

      {loading && !data && <p className="text-sm text-muted">Chargement des avis signalés…</p>}

      {data && (
        <section className="card" aria-labelledby="reported-reviews-title">
          <h2 id="reported-reviews-title" className="text-base font-semibold text-ink">
            {data.total ?? reviews.length} avis à examiner
          </h2>

          {reviews.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Aucun avis signalé pour le moment.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {reviews.map((review) => (
                <li key={review.id} className="py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Stars rating={review.rating} />
                        <span className="text-sm font-medium text-ink">{authorName(review)}</span>
                        <span className="text-xs text-muted">
                          sur {review.supplier?.company_name ?? 'un fournisseur'}
                        </span>
                        <span className="text-xs text-muted">
                          · commande #{review.order?.id ?? '—'} · {formatDate(review.created_at?.slice(0, 10))}
                        </span>
                      </div>
                      {review.comment && <p className="mt-2 text-sm text-ink">« {review.comment} »</p>}
                      {review.reports?.length > 0 && (
                        <ul className="mt-2 space-y-1 text-xs text-muted">
                          {review.reports.map((report) => (
                            <li key={report.id}>
                              Signalement : {report.reason_label ?? report.reason}
                              {report.details ? ` (${report.details})` : ''}
                              {report.author?.name ? ` — ${report.author.name}` : ''}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button type="button" className="btn btn-secondary" onClick={() => keep(review)}>
                        Conserver
                      </button>
                      <button type="button" className="btn btn-primary" onClick={() => openHide(review)}>
                        Masquer
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <Pagination currentPage={data.current_page} lastPage={data.last_page} onChange={setPage} className="mt-6" />
        </section>
      )}

      {target && (
        <Modal title="Masquer cet avis" onClose={() => setTarget(null)}>
          <form onSubmit={submitHide} className="space-y-4" noValidate>
            <p className="text-sm text-muted">
              L'avis sera retiré de la fiche fournisseur et la note moyenne recalculée. L'auteur sera notifié.
            </p>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-ink">Motif (facultatif)</span>
              <textarea
                rows="3"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={1000}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
                placeholder="Ex. propos injurieux"
              />
            </label>
            {actionError && (
              <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-sm text-rose-800">
                {actionError}
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button type="button" className="btn btn-secondary" onClick={() => setTarget(null)}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Masquage…' : "Masquer l'avis"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
