import { useCallback, useEffect, useState } from 'react'
import { createBuyerDispute, fetchBuyerDisputes } from '@/api/disputes'
import PageHeader from '@/components/PageHeader'
import Pagination from '@/components/Pagination'
import { formatAmount } from '@/utils/money'
import { formatDate } from '@/utils/period'

const STATUS_CLASSES = {
  ouvert: 'bg-rose-50 text-rose-800',
  'en cours': 'bg-amber-50 text-amber-800',
  décidé: 'bg-emerald-50 text-emerald-800',
}

/**
 * Litiges du porteur de projet (SCRUM-67 / F21).
 *
 * Un litige peut être ouvert uniquement sur une commande expédiée ou livrée,
 * et une seule procédure non décidée est autorisée par commande.
 */
export default function BuyerDisputesPage() {
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  const [orderId, setOrderId] = useState('')
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)

  const load = useCallback(async (currentPage) => {
    setLoading(true)
    setError(null)
    try {
      setData(await fetchBuyerDisputes({ page: currentPage, per_page: 15 }))
    } catch (requestError) {
      setError(requestError.userMessage ?? 'Impossible de charger vos litiges.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(page)
  }, [load, page])

  async function submit(event) {
    event.preventDefault()

    if (!orderId) {
      setFormError('Indiquez le numéro de la commande concernée.')
      return
    }
    if (reason.trim().length < 5) {
      setFormError('Le motif doit contenir au moins 5 caractères.')
      return
    }
    if (description.trim().length < 10) {
      setFormError('La description doit contenir au moins 10 caractères.')
      return
    }
    if (files.length > 5) {
      setFormError('Cinq pièces jointes au maximum.')
      return
    }

    setSubmitting(true)
    setFormError(null)
    try {
      const result = await createBuyerDispute(Number(orderId), {
        reason: reason.trim(),
        description: description.trim(),
        attachments: files,
      })
      setNotice(result?.message ?? 'Votre litige a été ouvert.')
      setOrderId('')
      setReason('')
      setDescription('')
      setFiles([])
      setPage(1)
      await load(1)
    } catch (requestError) {
      setFormError(requestError.userMessage ?? "Le litige n'a pas pu être ouvert.")
    } finally {
      setSubmitting(false)
    }
  }

  const disputes = data?.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mes litiges"
        subtitle="Ouvrez un litige sur une commande expédiée ou livrée et suivez la décision de l'administration."
      />

      {notice && (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {notice}
        </p>
      )}

      <section className="card" aria-labelledby="open-dispute-title">
        <h2 id="open-dispute-title" className="text-base font-semibold text-ink">
          Ouvrir un litige
        </h2>
        <p className="mt-1 text-sm text-muted">
          Le litige doit concerner une commande expédiée ou livrée. Une seule procédure non décidée par commande.
        </p>

        <form onSubmit={submit} className="mt-4 space-y-3" noValidate>
          <label className="block text-sm sm:w-64">
            <span className="mb-1 block font-medium text-ink">Numéro de commande</span>
            <input
              type="number"
              min="1"
              value={orderId}
              onChange={(event) => setOrderId(event.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
              placeholder="Ex. 42"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink">Motif</span>
            <input
              type="text"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={255}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
              placeholder="Ex. produit endommagé"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink">Description</span>
            <textarea
              rows="4"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={5000}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
              placeholder="Décrivez le problème constaté."
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink">Pièces jointes (facultatif)</span>
            <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
              className="block w-full text-sm text-muted"
            />
            <span className="mt-1 block text-xs text-muted">
              PDF, JPG ou PNG · 5 Mo maximum par fichier · 5 fichiers maximum.
            </span>
          </label>

          {formError && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-sm text-rose-800">
              {formError}
            </p>
          )}

          <div className="flex justify-end">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Ouverture…' : 'Ouvrir le litige'}
            </button>
          </div>
        </form>
      </section>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          <p>{error}</p>
          <button type="button" className="btn btn-secondary mt-3" onClick={() => load(page)}>
            Réessayer
          </button>
        </div>
      )}

      {loading && !data && <p className="text-sm text-muted">Chargement de vos litiges…</p>}

      {data && (
        <section className="card" aria-labelledby="disputes-title">
          <h2 id="disputes-title" className="text-base font-semibold text-ink">
            {data.total ?? disputes.length} litige(s)
          </h2>

          {disputes.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Vous n'avez ouvert aucun litige.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {disputes.map((dispute) => (
                <li key={dispute.id} className="py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-ink">Litige #{dispute.id}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_CLASSES[dispute.status] ?? 'bg-page text-muted'
                      }`}
                    >
                      {dispute.status}
                    </span>
                    <span className="text-xs text-muted">
                      Commande #{dispute.order?.id ?? '—'} · {formatAmount(dispute.order?.total)} ·{' '}
                      {formatDate(dispute.created_at?.slice(0, 10))}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-ink">{dispute.reason}</p>
                  <p className="mt-1 text-sm text-muted">{dispute.description}</p>
                  <p className="mt-2 text-xs text-muted">
                    Fournisseur : {dispute.order?.supplier?.company_name ?? '—'}
                    {dispute.assigned_admin?.name ? ` · suivi par ${dispute.assigned_admin.name}` : ''}
                  </p>
                  {dispute.decision && (
                    <p className="mt-2 rounded-lg bg-page p-2 text-xs text-ink">
                      Décision : {dispute.decision}
                      {dispute.decision_note ? ` — ${dispute.decision_note}` : ''}
                    </p>
                  )}
                  {dispute.attachments?.length > 0 && (
                    <p className="mt-2 text-xs text-muted">
                      {dispute.attachments.length} pièce(s) jointe(s)
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}

          <Pagination currentPage={data.current_page} lastPage={data.last_page} onChange={setPage} className="mt-6" />
        </section>
      )}
    </div>
  )
}
