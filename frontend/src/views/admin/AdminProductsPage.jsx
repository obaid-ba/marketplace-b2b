import { useCallback, useEffect, useState } from 'react'
import { fetchAdminProducts, withdrawProduct } from '@/api/adminModeration'
import Modal from '@/components/Modal'
import PageHeader from '@/components/PageHeader'
import Pagination from '@/components/Pagination'
import { formatAmount } from '@/utils/money'

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'publié', label: 'Publié' },
  { value: 'brouillon', label: 'Brouillon' },
  { value: 'retiré', label: 'Retiré' },
]

const STATUS_CLASSES = {
  publié: 'bg-emerald-50 text-emerald-800',
  brouillon: 'bg-amber-50 text-amber-800',
  retiré: 'bg-rose-50 text-rose-800',
}

/**
 * Contrôle du catalogue (SCRUM-72 / F29) : rechercher, filtrer et retirer un
 * produit avec un motif. Le retrait notifie le fournisseur et reste audité.
 */
export default function AdminProductsPage() {
  const [filters, setFilters] = useState({ q: '', status: '' })
  const [draftQuery, setDraftQuery] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  const [target, setTarget] = useState(null)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState(null)

  const load = useCallback(async (currentFilters, currentPage) => {
    setLoading(true)
    setError(null)
    try {
      const params = { page: currentPage, per_page: 20 }
      if (currentFilters.q) params.q = currentFilters.q
      if (currentFilters.status) params.status = currentFilters.status
      setData(await fetchAdminProducts(params))
    } catch (requestError) {
      setError(requestError.userMessage ?? 'Impossible de charger le catalogue.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(filters, page)
  }, [load, filters, page])

  function applySearch(event) {
    event.preventDefault()
    setPage(1)
    setFilters((current) => ({ ...current, q: draftQuery.trim() }))
  }

  function changeStatus(value) {
    setPage(1)
    setFilters((current) => ({ ...current, status: value }))
  }

  function openWithdraw(product) {
    setTarget(product)
    setReason('')
    setActionError(null)
    setNotice(null)
  }

  async function submitWithdraw(event) {
    event.preventDefault()
    if (reason.trim().length < 5) {
      setActionError('Le motif doit contenir au moins 5 caractères.')
      return
    }

    setSubmitting(true)
    setActionError(null)
    try {
      const result = await withdrawProduct(target.id, reason.trim())
      setNotice(result?.message ?? 'Le produit a été retiré.')
      setTarget(null)
      await load(filters, page)
    } catch (requestError) {
      setActionError(requestError.userMessage ?? 'Le retrait a échoué.')
    } finally {
      setSubmitting(false)
    }
  }

  const products = data?.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contrôle du catalogue"
        subtitle="Retirez les fiches non conformes : le fournisseur est notifié et peut corriger son produit."
      />

      {notice && (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {notice}
        </p>
      )}

      <section className="card" aria-label="Filtres du catalogue">
        <form onSubmit={applySearch} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm">
            <span className="mb-1 block font-medium text-ink">Recherche</span>
            <input
              type="search"
              value={draftQuery}
              onChange={(event) => setDraftQuery(event.target.value)}
              placeholder="Titre du produit"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
            />
          </label>
          <label className="text-sm sm:w-52">
            <span className="mb-1 block font-medium text-ink">Statut</span>
            <select
              value={filters.status}
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
          <button type="submit" className="btn btn-primary">
            Filtrer
          </button>
        </form>
      </section>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800">
          <p>{error}</p>
          <button type="button" className="btn btn-secondary mt-3" onClick={() => load(filters, page)}>
            Réessayer
          </button>
        </div>
      )}

      {loading && !data && <p className="text-sm text-muted">Chargement du catalogue…</p>}

      {data && (
        <section className="card" aria-labelledby="products-title">
          <h2 id="products-title" className="text-base font-semibold text-ink">
            {data.total ?? products.length} produit(s)
          </h2>

          {products.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Aucun produit ne correspond à ces critères.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {products.map((product) => (
                <li key={product.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-ink">{product.title}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_CLASSES[product.status] ?? 'bg-page text-muted'
                        }`}
                      >
                        {product.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {product.supplier?.company_name ?? 'Fournisseur'} · {product.category?.name ?? 'Sans catégorie'} ·{' '}
                      {formatAmount(product.price)}
                    </p>
                    {product.withdrawal_reason && (
                      <p className="mt-1 text-xs text-rose-700">Motif de retrait : {product.withdrawal_reason}</p>
                    )}
                  </div>
                  {product.status !== 'retiré' && (
                    <button type="button" className="btn btn-secondary shrink-0" onClick={() => openWithdraw(product)}>
                      Retirer du catalogue
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          <Pagination currentPage={data.current_page} lastPage={data.last_page} onChange={setPage} className="mt-6" />
        </section>
      )}

      {target && (
        <Modal title={`Retirer « ${target.title} »`} onClose={() => setTarget(null)}>
          <form onSubmit={submitWithdraw} className="space-y-4" noValidate>
            <p className="text-sm text-muted">
              Le produit passera au statut « retiré ». Le fournisseur recevra le motif et pourra le corriger.
            </p>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-ink">Motif du retrait</span>
              <textarea
                rows="3"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={1000}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
                placeholder="Ex. allégations non vérifiables sur la fiche"
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
                {submitting ? 'Retrait…' : 'Confirmer le retrait'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
