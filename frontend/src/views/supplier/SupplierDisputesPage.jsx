import { useCallback, useEffect, useState } from 'react'
import { fetchSupplierDisputes } from '@/api/disputes'
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
 * Litiges reçus par le fournisseur (SCRUM-67 / F21). Lecture seule : la
 * décision appartient à l'administration, qui notifie les deux parties.
 */
export default function SupplierDisputesPage() {
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async (currentPage) => {
    setLoading(true)
    setError(null)
    try {
      setData(await fetchSupplierDisputes({ page: currentPage, per_page: 15 }))
    } catch (requestError) {
      setError(requestError.userMessage ?? 'Impossible de charger les litiges.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(page)
  }, [load, page])

  const disputes = data?.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Litiges reçus"
        subtitle="Consultez les litiges ouverts sur vos commandes et la décision rendue par l'administration."
      />

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          <p>{error}</p>
          <button type="button" className="btn btn-secondary mt-3" onClick={() => load(page)}>
            Réessayer
          </button>
        </div>
      )}

      {loading && !data && <p className="text-sm text-muted">Chargement des litiges…</p>}

      {data && (
        <section className="card" aria-labelledby="supplier-disputes-title">
          <h2 id="supplier-disputes-title" className="text-base font-semibold text-ink">
            {data.total ?? disputes.length} litige(s)
          </h2>

          {disputes.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Aucun litige n'a été ouvert sur vos commandes.</p>
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
