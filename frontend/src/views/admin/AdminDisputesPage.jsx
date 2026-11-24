import { useCallback, useEffect, useState } from 'react'
import { assignDispute, decideDispute, fetchAdminDisputes } from '@/api/disputes'
import Modal from '@/components/Modal'
import PageHeader from '@/components/PageHeader'
import Pagination from '@/components/Pagination'
import { formatAmount } from '@/utils/money'
import { formatDate } from '@/utils/period'

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les litiges' },
  { value: 'ouvert', label: 'Ouverts' },
  { value: 'en cours', label: 'En cours' },
  { value: 'décidé', label: 'Décidés' },
]

const STATUS_CLASSES = {
  ouvert: 'bg-rose-50 text-rose-800',
  'en cours': 'bg-amber-50 text-amber-800',
  décidé: 'bg-emerald-50 text-emerald-800',
}

/**
 * Litiges (SCRUM-73 / F21) : file triée par urgence, prise en charge puis
 * décision motivée. Les deux parties sont notifiées à chaque étape.
 */
export default function AdminDisputesPage() {
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  const [target, setTarget] = useState(null)
  const [decision, setDecision] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState(null)

  const load = useCallback(async (currentStatus, currentPage) => {
    setLoading(true)
    setError(null)
    try {
      const params = { page: currentPage, per_page: 20 }
      if (currentStatus) params.status = currentStatus
      setData(await fetchAdminDisputes(params))
    } catch (requestError) {
      setError(requestError.userMessage ?? 'Impossible de charger les litiges.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(status, page)
  }, [load, status, page])

  function changeStatus(value) {
    setPage(1)
    setStatus(value)
  }

  async function take(dispute) {
    setActionError(null)
    setNotice(null)
    try {
      const result = await assignDispute(dispute.id)
      setNotice(result?.message ?? 'Le litige est en cours de traitement.')
      await load(status, page)
    } catch (requestError) {
      setActionError(requestError.userMessage ?? 'La prise en charge a échoué.')
    }
  }

  function openDecide(dispute) {
    setTarget(dispute)
    setDecision('')
    setNote('')
    setActionError(null)
    setNotice(null)
  }

  async function submitDecision(event) {
    event.preventDefault()
    if (decision.trim().length < 3) {
      setActionError('La décision doit contenir au moins 3 caractères.')
      return
    }
    if (note.trim().length < 5) {
      setActionError('La note doit contenir au moins 5 caractères.')
      return
    }

    setSubmitting(true)
    setActionError(null)
    try {
      const result = await decideDispute(target.id, { decision: decision.trim(), note: note.trim() })
      setNotice(result?.message ?? 'La décision a été enregistrée.')
      setTarget(null)
      await load(status, page)
    } catch (requestError) {
      setActionError(requestError.userMessage ?? "La décision n'a pas pu être enregistrée.")
    } finally {
      setSubmitting(false)
    }
  }

  const disputes = data?.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Litiges"
        subtitle="Les litiges ouverts sont traités en premier, du plus ancien au plus récent."
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

      <section className="card" aria-label="Filtre des litiges">
        <label className="block text-sm sm:w-64">
          <span className="mb-1 block font-medium text-ink">Statut</span>
          <select
            value={status}
            onChange={(event) => changeStatus(event.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          <p>{error}</p>
          <button type="button" className="btn btn-secondary mt-3" onClick={() => load(status, page)}>
            Réessayer
          </button>
        </div>
      )}

      {loading && !data && <p className="text-sm text-muted">Chargement des litiges…</p>}

      {data && (
        <section className="card" aria-labelledby="disputes-title">
          <h2 id="disputes-title" className="text-base font-semibold text-ink">
            {data.total ?? disputes.length} litige(s)
          </h2>

          {disputes.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Aucun litige ne correspond à ce filtre.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {disputes.map((dispute) => (
                <li key={dispute.id} className="py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
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
                          Commande #{dispute.order?.id ?? '—'} · {formatAmount(dispute.order?.total)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-medium text-ink">{dispute.reason}</p>
                      <p className="mt-1 text-sm text-muted">{dispute.description}</p>
                      <p className="mt-2 text-xs text-muted">
                        Ouvert par {dispute.opener?.name ?? 'un utilisateur'} le{' '}
                        {formatDate(dispute.created_at?.slice(0, 10))}
                        {dispute.order?.supplier?.company_name
                          ? ` · fournisseur ${dispute.order.supplier.company_name}`
                          : ''}
                        {dispute.assigned_admin?.name ? ` · suivi par ${dispute.assigned_admin.name}` : ''}
                      </p>
                      {dispute.decision && (
                        <p className="mt-2 rounded-lg bg-page p-2 text-xs text-ink">
                          Décision : {dispute.decision}
                          {dispute.decision_note ? ` — ${dispute.decision_note}` : ''}
                        </p>
                      )}
                    </div>

                    {dispute.status !== 'décidé' && (
                      <div className="flex shrink-0 flex-wrap gap-2">
                        {dispute.status === 'ouvert' && (
                          <button type="button" className="btn btn-secondary" onClick={() => take(dispute)}>
                            Prendre en charge
                          </button>
                        )}
                        <button type="button" className="btn btn-primary" onClick={() => openDecide(dispute)}>
                          Rendre une décision
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <Pagination currentPage={data.current_page} lastPage={data.last_page} onChange={setPage} className="mt-6" />
        </section>
      )}

      {target && (
        <Modal title={`Décision du litige #${target.id}`} onClose={() => setTarget(null)}>
          <form onSubmit={submitDecision} className="space-y-4" noValidate>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-ink">Décision</span>
              <input
                type="text"
                value={decision}
                onChange={(event) => setDecision(event.target.value)}
                maxLength={255}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
                placeholder="Ex. remboursement partiel"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-ink">Note motivée</span>
              <textarea
                rows="4"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={5000}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
                placeholder="Expliquez la décision aux deux parties"
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
                {submitting ? 'Enregistrement…' : 'Enregistrer la décision'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
