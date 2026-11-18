import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { fetchSupplierReviews, replyToSupplierReview } from '@/api/reviews'

export default function SupplierReviewsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)

  // Gestion des formulaires de réponse : { [reviewId]: string }
  const [replyDrafts, setReplyDrafts] = useState({})
  const [activeReplyId, setActiveReplyId] = useState(null)
  const [replySubmitting, setReplySubmitting] = useState(false)
  const [replyError, setReplyError] = useState(null)
  const [replySuccess, setReplySuccess] = useState(null)

  const loadReviews = useCallback(async (pageNumber = 1) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchSupplierReviews(pageNumber)
      setData(res)
    } catch (err) {
      setError(err.userMessage ?? 'Impossible de charger vos avis.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadReviews(page)
  }, [loadReviews, page])

  const handleOpenReplyForm = (reviewId) => {
    setActiveReplyId(reviewId)
    setReplyError(null)
    setReplySuccess(null)
    if (!replyDrafts[reviewId]) {
      setReplyDrafts((prev) => ({ ...prev, [reviewId]: '' }))
    }
  }

  const handleCancelReply = () => {
    setActiveReplyId(null)
    setReplyError(null)
  }

  const handleReplyChange = (reviewId, text) => {
    setReplyDrafts((prev) => ({ ...prev, [reviewId]: text }))
  }

  const handleSubmitReply = async (reviewId) => {
    const text = replyDrafts[reviewId]?.trim()
    if (!text || text.length < 2) {
      setReplyError('Votre réponse doit contenir au moins 2 caractères.')
      return
    }

    setReplySubmitting(true)
    setReplyError(null)
    setReplySuccess(null)

    try {
      const res = await replyToSupplierReview(reviewId, text)
      // Mettre à jour l'avis dans la liste locale
      setData((prev) => {
        if (!prev) return prev
        const updatedList = prev.reviews.data.map((r) =>
          r.id === reviewId ? { ...r, supplier_reply: res.review.supplier_reply } : r,
        )
        return {
          ...prev,
          reviews: {
            ...prev.reviews,
            data: updatedList,
          },
        }
      })
      setReplySuccess('Votre réponse a été publiée avec succès.')
      setActiveReplyId(null)
    } catch (err) {
      setReplyError(
        err.response?.data?.message ?? err.userMessage ?? 'Impossible d\'enregistrer votre réponse.',
      )
    } finally {
      setReplySubmitting(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-5xl py-12 text-center text-slate-500">
        <p>Chargement de vos avis clients...</p>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="mx-auto max-w-5xl py-12">
        <div className="card text-center text-rose-700 bg-rose-50 border-rose-200">
          <p className="font-semibold">{error}</p>
          <button
            type="button"
            onClick={() => loadReviews(page)}
            className="btn btn-secondary mt-4 inline-block text-xs"
          >
            Réessayer
          </button>
        </div>
      </div>
    )
  }

  const ratingAvg = Number(data?.rating_avg || 0)
  const reviewsCount = Number(data?.reviews_count || 0)
  const starDistribution = data?.star_distribution || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  const reviewsList = data?.reviews?.data || []
  const pagination = data?.reviews

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Mes avis clients</h1>
        <p className="text-xs text-slate-500 mt-1">
          Consultez les retours d'expérience de vos acheteurs et répondez à leurs avis pour renforcer votre réputation.
        </p>
      </div>

      {replySuccess && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-800">
          ✓ {replySuccess}
        </div>
      )}

      {/* Cartes statistiques globales */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {/* Note Moyenne Globale */}
        <div className="card flex flex-col items-center justify-center p-6 text-center bg-linear-to-b from-white to-amber-50/20 border-amber-200/60">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Note moyenne</span>
          <div className="mt-2 text-4xl font-black text-amber-500">
            {ratingAvg.toFixed(1)} <span className="text-lg font-normal text-slate-400">/ 5</span>
          </div>
          <div className="mt-1 flex items-center gap-1 text-lg text-amber-400">
            {[1, 2, 3, 4, 5].map((star) => (
              <span key={star}>{ratingAvg >= star ? '★' : '☆'}</span>
            ))}
          </div>
          <p className="mt-2 text-xs font-medium text-slate-600">
            Basée sur {reviewsCount} avis client{reviewsCount > 1 ? 's' : ''}
          </p>
        </div>

        {/* Répartition des étoiles */}
        <div className="card sm:col-span-2 p-6 space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">
            Répartition des évaluations
          </span>
          {[5, 4, 3, 2, 1].map((stars) => {
            const count = starDistribution[stars] || 0
            const percentage = reviewsCount > 0 ? Math.round((count / reviewsCount) * 100) : 0
            return (
              <div key={stars} className="flex items-center gap-3 text-xs">
                <span className="w-12 font-medium text-slate-600 shrink-0">
                  {stars} {stars > 1 ? 'étoiles' : 'étoile'}
                </span>
                <div className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-400 transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="w-14 text-right font-mono text-slate-500 shrink-0">
                  {count} ({percentage}%)
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Liste des avis reçus */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900">
          Tous les avis ({reviewsCount})
        </h2>

        {reviewsList.length === 0 ? (
          <div className="card text-center py-12 text-slate-500 space-y-2">
            <span className="text-3xl">⭐</span>
            <p className="font-semibold text-slate-800">Aucun avis reçu pour le moment</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Vos évaluations apparaîtront ici dès que vos acheteurs auront confirmé la réception de leurs commandes.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviewsList.map((review) => {
              const reviewDate = new Date(review.created_at).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })
              const buyerName = review.buyer?.organization || review.buyer?.user?.name || 'Acheteur'
              const isReplying = activeReplyId === review.id

              return (
                <div key={review.id} className="card p-5 space-y-3 border-slate-200">
                  {/* Ligne d'en-tête de l'avis */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center text-amber-400 text-base">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span key={star}>{review.rating >= star ? '★' : '☆'}</span>
                        ))}
                      </div>
                      <span className="text-xs font-bold text-slate-800">{buyerName}</span>
                      {review.rating <= 2 && (
                        <span className="rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                          Avis critique
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      {review.order && (
                        <Link
                          to={`/orders/${review.order.id}`}
                          className="font-medium text-brand-600 hover:underline"
                        >
                          Commande #{review.order.id}
                        </Link>
                      )}
                      <span>•</span>
                      <span>{reviewDate}</span>
                    </div>
                  </div>

                  {/* Commentaire acheteur */}
                  {review.comment ? (
                    <p className="text-xs text-slate-700 leading-relaxed">
                      « {review.comment} »
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 italic">
                      L'acheteur n'a pas laissé de commentaire écrit.
                    </p>
                  )}

                  {/* Section Réponse Fournisseur */}
                  {review.supplier_reply ? (
                    <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-3.5 text-xs space-y-1">
                      <p className="font-bold text-brand-900">Votre réponse :</p>
                      <p className="text-brand-800 leading-relaxed">« {review.supplier_reply} »</p>
                    </div>
                  ) : isReplying ? (
                    <div className="rounded-xl border border-slate-300 bg-slate-50/70 p-4 space-y-3">
                      <label htmlFor={`reply-${review.id}`} className="block text-xs font-bold text-slate-800 uppercase">
                        Votre réponse publique à {buyerName} :
                      </label>

                      {replyError && (
                        <div role="alert" className="rounded-md bg-rose-50 border border-rose-200 p-2 text-xs text-rose-700">
                          ⚠️ {replyError}
                        </div>
                      )}

                      <textarea
                        id={`reply-${review.id}`}
                        rows="3"
                        maxLength="2000"
                        value={replyDrafts[review.id] || ''}
                        onChange={(e) => handleReplyChange(review.id, e.target.value)}
                        placeholder="Remerciez l'acheteur ou apportez des éclaircissements professionnels..."
                        className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-xs text-slate-900 focus:border-brand-500 focus:outline-hidden"
                      />
                      <p className="text-right text-[10px] text-slate-400">
                        {(replyDrafts[review.id] || '').length}/2000
                      </p>

                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={handleCancelReply}
                          disabled={replySubmitting}
                          className="btn btn-secondary text-xs"
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSubmitReply(review.id)}
                          disabled={replySubmitting}
                          className="btn btn-primary text-xs bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50"
                        >
                          {replySubmitting ? 'Publication...' : 'Publier ma réponse'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => handleOpenReplyForm(review.id)}
                        className="btn btn-secondary inline-flex items-center gap-1.5 text-xs py-1 px-3"
                      >
                        💬 Répondre à cet avis
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.last_page > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-xs">
            <span className="text-slate-500">
              Page {pagination.current_page} sur {pagination.last_page}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pagination.current_page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="btn btn-secondary text-xs disabled:opacity-40"
              >
                ← Précédent
              </button>
              <button
                type="button"
                disabled={pagination.current_page >= pagination.last_page}
                onClick={() => setPage((p) => Math.min(pagination.last_page, p + 1))}
                className="btn btn-secondary text-xs disabled:opacity-40"
              >
                Suivant →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
