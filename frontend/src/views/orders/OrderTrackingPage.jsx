import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import {
  advanceSupplierOrder,
  confirmReceiptOrder,
  fetchDocumentDownloadBlob,
  fetchOrderDetails,
} from '@/api/orders'
import { submitBuyerReview } from '@/api/reviews'
import ContactButton from '@/components/ContactButton'
import OrderDisputeCard from '@/components/disputes/OrderDisputeCard'
import { OrderStatusBadge, OrderStatusProgress } from '@/components/orders/OrderStatusBadge'
import { selectRole, selectUser, useAuthStore } from '@/stores/auth'
import { PATHS } from '@/router/paths'
import { ROLES } from '@/utils/roles'

export default function OrderTrackingPage() {
  const { id } = useParams()
  const role = useAuthStore(selectRole)
  const user = useAuthStore(selectUser)

  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [advanceLoading, setAdvanceLoading] = useState(false)
  const [advanceError, setAdvanceError] = useState(null)
  const [advanceSuccess, setAdvanceSuccess] = useState(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [confirmError, setConfirmError] = useState(null)
  const [confirmSuccess, setConfirmSuccess] = useState(null)
  const [downloadingDocId, setDownloadingDocId] = useState(null)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewError, setReviewError] = useState(null)
  const [reviewSuccess, setReviewSuccess] = useState(null)

  const loadOrder = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchOrderDetails(id)
      setOrder(data)
    } catch (err) {
      setError(err.userMessage ?? 'Impossible de charger les détails de la commande.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadOrder()
  }, [loadOrder])

  // Action Fournisseur : avancement du statut validée -> expédiée -> livrée (SCRUM-55)
  const handleAdvanceStatus = async () => {
    if (!order || advanceLoading) return
    setAdvanceLoading(true)
    setAdvanceError(null)
    setAdvanceSuccess(null)

    try {
      const res = await advanceSupplierOrder(order.id)
      setOrder(res.order)
      setAdvanceSuccess(res.message ?? `Statut de la commande mis à jour vers « ${res.order.status} ».`)
    } catch (err) {
      setAdvanceError(
        err.response?.data?.message ?? err.userMessage ?? 'Impossible de faire avancer le statut de la commande.',
      )
    } finally {
      setAdvanceLoading(false)
    }
  }

  // Action Acheteur : confirmation de la réception et clôture (SCRUM-56, SCRUM-57)
  const handleConfirmReceipt = async () => {
    if (!order || confirmLoading) return
    const confirmed = window.confirm(
      'Confirmez-vous la bonne réception de l\'ensemble des articles de cette commande ? Cette action clôturera la commande et générera la facture finale.',
    )
    if (!confirmed) return

    setConfirmLoading(true)
    setConfirmError(null)
    setConfirmSuccess(null)

    try {
      const res = await confirmReceiptOrder(order.id)
      setOrder(res.order)
      setConfirmSuccess(res.message ?? 'Réception confirmée avec succès. La commande est désormais clôturée.')
    } catch (err) {
      setConfirmError(
        err.response?.data?.message ?? err.userMessage ?? 'Impossible de confirmer la réception de la commande.',
      )
    } finally {
      setConfirmLoading(false)
    }
  }

  // Action Acheteur : dépôt d'avis sur la commande clôturée (SCRUM-64 / F20)
  const handleSubmitReview = async (e) => {
    e?.preventDefault()
    if (!order || reviewSubmitting) return
    setReviewSubmitting(true)
    setReviewError(null)
    setReviewSuccess(null)

    try {
      const res = await submitBuyerReview(order.id, {
        rating: reviewRating,
        comment: reviewComment.trim() || undefined,
      })
      setOrder((prev) => ({
        ...prev,
        review: res.review,
      }))
      setReviewSuccess(res.message ?? 'Votre avis a été enregistré avec succès.')
      setShowReviewForm(false)
    } catch (err) {
      setReviewError(
        err.response?.data?.message ?? err.userMessage ?? 'Impossible d\'enregistrer votre avis.',
      )
    } finally {
      setReviewSubmitting(false)
    }
  }

  const handleDownloadDocument = async (doc) => {
    setDownloadingDocId(doc.id)
    try {
      const blob = await fetchDocumentDownloadBlob(doc.id)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${doc.type}_${doc.number}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      alert('Impossible de télécharger le document.')
    } finally {
      setDownloadingDocId(null)
    }
  }

  const backLink = role === ROLES.SUPPLIER ? PATHS.supplierOrders : PATHS.buyerOrders

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl py-12 text-center text-slate-500">
        <p>Chargement du suivi de commande...</p>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-4xl py-12">
        <div className="card text-center text-rose-700 bg-rose-50 border-rose-200">
          <p className="font-semibold">{error ?? 'Commande introuvable.'}</p>
          <Link to={backLink} className="btn btn-secondary mt-4 inline-block">
            Retour à mes commandes
          </Link>
        </div>
      </div>
    )
  }

  const supplier = order.supplier
  const buyer = order.buyer
  const buyerUser = buyer?.user
  const items = order.items ?? []
  const history = order.status_history ?? order.statusHistory ?? []
  const docs = order.documents ?? []

  // Est-ce que l'utilisateur connecté est le fournisseur de la commande ?
  const isSupplier =
    (role === ROLES.SUPPLIER || user?.role === 'supplier') &&
    (supplier?.user_id === user?.id || supplier?.user?.id === user?.id || (!supplier?.user_id && role === ROLES.SUPPLIER))

  // Est-ce que l'utilisateur connecté est l'acheteur de la commande ?
  const isBuyer =
    (role === ROLES.BUYER || user?.role === 'buyer') &&
    (buyer?.user_id === user?.id || buyerUser?.id === user?.id || (!buyer?.user_id && role === ROLES.BUYER))

  // Documents spécifiques
  const quoteDoc = docs.find((d) => d.type === 'devis')
  const invoiceDoc = docs.find((d) => d.type === 'facture')
  const isClosed = order.status === 'clôturée'

  const formattedDate = new Date(order.created_at).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* En-tête navigation & Titre */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link to={backLink} className="text-xs font-semibold text-brand-600 hover:underline">
            ← Retour à la liste des commandes
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Commande #{order.id}
          </h1>
          <p className="text-xs text-slate-500">
            Passée le {formattedDate} • Origine : <span className="font-medium uppercase">{order.origin}</span>
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {(isBuyer || isSupplier) && (
            <ContactButton contextType="commande" contextId={order.id} label={isSupplier ? "Contacter l'acheteur" : 'Contacter le fournisseur'} />
          )}
          <OrderStatusBadge status={order.status} />
          <span className="text-xl font-black text-slate-900">
            {Number(order.total).toFixed(2)} <span className="text-xs font-normal">TND</span>
          </span>
        </div>
      </div>

      {/* Notifications d'action */}
      {(advanceSuccess || confirmSuccess) && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-800">
          ✓ {advanceSuccess || confirmSuccess}
        </div>
      )}

      {(advanceError || confirmError) && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800">
          ⚠️ {advanceError || confirmError}
        </div>
      )}

      {/* Ligne de temps (Timeline) en 4 étapes : Validée -> Expédiée -> Livrée -> Clôturée */}
      <div className="card p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Évolution de la commande (Timeline)
          </h2>

          {/* Actions Fournisseur (SCRUM-55) & Acheteur (SCRUM-56) */}
          <div className="flex items-center gap-2">
            {isSupplier && (
              <>
                {order.status === 'validée' && (
                  <button
                    type="button"
                    onClick={handleAdvanceStatus}
                    disabled={advanceLoading}
                    className="btn btn-primary text-xs font-semibold shadow-xs disabled:opacity-50"
                  >
                    {advanceLoading ? 'Mise à jour...' : 'Marquer comme expédiée'}
                  </button>
                )}
                {order.status === 'expédiée' && (
                  <button
                    type="button"
                    onClick={handleAdvanceStatus}
                    disabled={advanceLoading}
                    className="btn btn-primary text-xs font-semibold shadow-xs disabled:opacity-50"
                  >
                    {advanceLoading ? 'Mise à jour...' : 'Marquer comme livrée'}
                  </button>
                )}
              </>
            )}

            {isBuyer && order.status === 'livrée' && (
              <button
                type="button"
                onClick={handleConfirmReceipt}
                disabled={confirmLoading}
                className="btn btn-primary text-xs font-semibold shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
              >
                {confirmLoading ? 'Confirmation...' : 'Confirmer la réception'}
              </button>
            )}
          </div>
        </div>

        <OrderStatusProgress status={order.status} statusHistory={history} />
      </div>

      {(isBuyer || isSupplier) && <OrderDisputeCard key={order.status} orderId={order.id} />}

      {/* Tableau des articles commandés (sans section de paiement en ligne) */}
      <div className="card space-y-4">
        <h2 className="text-base font-bold text-slate-900">Articles commandés</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500">
                <th className="pb-2 font-medium">Désignation</th>
                <th className="pb-2 font-medium text-center">Quantité</th>
                <th className="pb-2 font-medium text-right">Prix unitaire</th>
                <th className="pb-2 font-medium text-right">Sous-total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => {
                const unitPriceNum = Number(item.unit_price)
                const subtotal = item.line_total ? Number(item.line_total) : unitPriceNum * item.quantity

                return (
                  <tr key={item.id} className="text-slate-800">
                    <td className="py-3 font-medium">
                      {item.label}
                      {item.product_id && (
                        <span className="block text-xs text-slate-400 font-normal">
                          Réf. article #{item.product_id}
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-center">{item.quantity}</td>
                    <td className="py-3 text-right">{unitPriceNum.toFixed(2)} TND</td>
                    <td className="py-3 text-right font-semibold">
                      {subtotal.toFixed(2)} TND
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 text-slate-900">
                <td colSpan="3" className="pt-3 text-right font-bold text-sm">
                  Total de la commande :
                </td>
                <td className="pt-3 text-right font-extrabold text-base text-brand-700">
                  {Number(order.total).toFixed(2)} TND
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Bloc Documents PDF (SCRUM-54, SCRUM-58) */}
      <div className="card space-y-3">
        <h2 className="text-base font-bold text-slate-900">Documents commerciaux (PDF)</h2>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Devis PDF (si commande issue d'un devis) */}
          <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
            <p className="text-xs font-semibold text-slate-500 uppercase">Devis commercial</p>
            {order.origin === 'devis' ? (
              quoteDoc ? (
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-800">Devis #{quoteDoc.number}</span>
                  <button
                    type="button"
                    onClick={() => handleDownloadDocument(quoteDoc)}
                    disabled={downloadingDocId === quoteDoc.id}
                    className="btn btn-secondary inline-flex items-center gap-1.5 text-xs py-1 px-2.5"
                  >
                    📄 Télécharger le devis PDF
                  </button>
                </div>
              ) : (
                <p className="mt-1 text-xs text-slate-600">Devis initial associé à l'appel d'offres</p>
              )
            ) : (
              <p className="mt-1 text-xs text-slate-400 italic">Commande directe sur catalogue (sans devis préalable)</p>
            )}
          </div>

          {/* Facture PDF (dès que la commande est clôturée) */}
          <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
            <p className="text-xs font-semibold text-slate-500 uppercase">Facture</p>
            {invoiceDoc ? (
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-800">Facture #{invoiceDoc.number}</span>
                <button
                  type="button"
                  onClick={() => handleDownloadDocument(invoiceDoc)}
                  disabled={downloadingDocId === invoiceDoc.id}
                  className="btn btn-secondary inline-flex items-center gap-1.5 text-xs py-1 px-2.5"
                >
                  📄 Télécharger la facture PDF
                </button>
              </div>
            ) : isClosed ? (
              <p className="mt-1 text-xs text-slate-600">Commande clôturée : facture en cours de génération</p>
            ) : (
              <p className="mt-1 text-xs text-slate-400 italic">La facture PDF sera disponible dès la clôture de la commande.</p>
            )}
          </div>
        </div>

        {/* Autres documents joints éventuels */}
        {docs.filter((d) => d.id !== quoteDoc?.id && d.id !== invoiceDoc?.id).length > 0 && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <p className="text-xs font-semibold text-slate-500 mb-2">Autres pièces jointes :</p>
            <div className="flex flex-wrap gap-2">
              {docs
                .filter((d) => d.id !== quoteDoc?.id && d.id !== invoiceDoc?.id)
                .map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => handleDownloadDocument(doc)}
                    disabled={downloadingDocId === doc.id}
                    className="btn btn-secondary inline-flex items-center gap-1.5 text-xs py-1 px-2.5"
                  >
                    📄 {doc.type} #{doc.number}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Invitation & Formulaire pour laisser un avis après clôture (SCRUM-56, SCRUM-64 / F20) */}
      {isClosed && !order.review && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-amber-900">
                Votre commande est clôturée — Laissez un avis sur ce fournisseur
              </h3>
              <p className="mt-1 text-xs text-amber-700">
                Partagez votre retour d'expérience avec la communauté pour aider d'autres acheteurs à choisir {supplier?.company_name ?? 'ce fournisseur'}.
              </p>
            </div>
            {isBuyer && !showReviewForm && (
              <button
                type="button"
                className="btn btn-primary text-xs font-semibold shrink-0 bg-amber-600 hover:bg-amber-700 text-white"
                onClick={() => setShowReviewForm(true)}
              >
                ⭐ Laisser un avis
              </button>
            )}
          </div>

          {isBuyer && showReviewForm && (
            <form onSubmit={handleSubmitReview} className="rounded-xl border border-amber-300 bg-white p-4 space-y-4">
              {reviewError && (
                <div role="alert" className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
                  ⚠️ {reviewError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Note globale ({reviewRating}/5)
                </label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      aria-label={`${star} étoile${star > 1 ? 's' : ''}`}
                      onClick={() => setReviewRating(star)}
                      className={`text-2xl transition hover:scale-110 focus:outline-hidden ${
                        reviewRating >= star ? 'text-amber-400' : 'text-slate-200'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                  <span className="ml-2 text-xs font-medium text-slate-500">
                    {reviewRating === 5 && 'Excellent'}
                    {reviewRating === 4 && 'Très bien'}
                    {reviewRating === 3 && 'Correct'}
                    {reviewRating === 2 && 'Médiocre'}
                    {reviewRating === 1 && 'Très décevant'}
                  </span>
                </div>
              </div>

              <div>
                <label htmlFor="review-comment" className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Commentaire (optionnel)
                </label>
                <textarea
                  id="review-comment"
                  rows="3"
                  maxLength="2000"
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Conformité des produits, respect des délais de livraison, relationnel..."
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-brand-500 focus:outline-hidden"
                />
                <p className="text-right text-[10px] text-slate-400">{reviewComment.length}/2000</p>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowReviewForm(false)}
                  disabled={reviewSubmitting}
                  className="btn btn-secondary text-xs"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={reviewSubmitting}
                  className="btn btn-primary text-xs bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-50"
                >
                  {reviewSubmitting ? 'Envoi...' : 'Publier mon avis'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {reviewSuccess && (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-800">
          ✓ {reviewSuccess}
        </div>
      )}

      {order.review && (
        <div className="card space-y-3 border-emerald-200 bg-emerald-50/40">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-emerald-900">Avis laissé sur cette commande</h3>
            <div className="flex items-center gap-1 text-sm font-black text-amber-500">
              {'★'.repeat(order.review.rating || 5)}{'☆'.repeat(5 - (order.review.rating || 5))}
              <span className="text-xs text-slate-600 font-semibold ml-1">({order.review.rating}/5)</span>
            </div>
          </div>

          {order.review.comment && (
            <p className="text-xs text-slate-700 italic bg-white/70 rounded-lg p-3 border border-emerald-100">
              « {order.review.comment} »
            </p>
          )}

          {order.review.supplier_reply && (
            <div className="rounded-lg border border-brand-200 bg-brand-50/60 p-3 text-xs space-y-1">
              <p className="font-bold text-brand-900">
                Réponse de {supplier?.company_name ?? 'l\'entreprise'} :
              </p>
              <p className="text-brand-800 italic">« {order.review.supplier_reply} »</p>
            </div>
          )}
        </div>
      )}

      {/* Parties prenantes : Fournisseur & Acheteur */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Informations Fournisseur */}
        <div className="card space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Fournisseur</h2>
          <p className="text-base font-bold text-slate-900">{supplier?.company_name}</p>
          {supplier?.user && (
            <p className="text-xs text-slate-600">
              Contact : {supplier.user.name} • {supplier.user.email} {supplier.user.phone ? `• ${supplier.user.phone}` : ''}
            </p>
          )}
          {supplier?.city && (
            <p className="text-xs text-slate-500">Adresse : {supplier.address ? `${supplier.address}, ` : ''}{supplier.city}</p>
          )}
          {supplier?.payment_terms && (
            <div className="mt-2 rounded bg-slate-50 p-2 text-xs text-slate-600">
              <span className="font-semibold">Conditions de règlement : </span>
              {supplier.payment_terms}
            </div>
          )}
        </div>

        {/* Informations Acheteur */}
        <div className="card space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Acheteur</h2>
          <p className="text-base font-bold text-slate-900">
            {buyer?.organization || buyerUser?.name || 'Acheteur'}
          </p>
          {buyerUser && (
            <p className="text-xs text-slate-600">
              Contact : {buyerUser.name} • {buyerUser.email} {buyerUser.phone ? `• ${buyerUser.phone}` : ''}
            </p>
          )}
          {buyer?.city && (
            <p className="text-xs text-slate-500">Ville : {buyer.city}</p>
          )}
          <div className="mt-2 rounded bg-amber-50 border border-amber-200 p-2 text-xs text-amber-900">
            Règlement direct hors plateforme : aucun paiement en ligne.
          </div>
        </div>
      </div>

      {/* Historique chronologique d'activité */}
      {history.length > 0 && (
        <div className="card space-y-3">
          <h2 className="text-base font-bold text-slate-900">Historique d'activité</h2>
          <ul className="divide-y divide-slate-100 text-xs">
            {history.map((h) => {
              const dateStr = new Date(h.changed_at).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
              return (
                <li key={h.id} className="flex items-center justify-between py-2 text-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">Statut passé à :</span>
                    <OrderStatusBadge status={h.status} />
                    {h.changer && (
                      <span className="text-slate-500">par {h.changer.name}</span>
                    )}
                  </div>
                  <span className="text-slate-400 font-mono">{dateStr}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
