import { useCallback, useEffect, useState } from 'react'
import { deleteUser, fetchAdminUsers, reactivateUser, suspendUser } from '@/api/adminUsers'
import Modal from '@/components/Modal'
import PageHeader from '@/components/PageHeader'
import Pagination from '@/components/Pagination'

const ROLE_OPTIONS = [
  { value: '', label: 'Tous les rôles' },
  { value: 'supplier', label: 'Fournisseur' },
  { value: 'buyer', label: 'Porteur de projet' },
  { value: 'admin', label: 'Administrateur' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'Tous les statuts' },
  { value: 'actif', label: 'Actif' },
  { value: 'suspendu', label: 'Suspendu' },
  { value: 'désactivé', label: 'Désactivé' },
  { value: 'e-mail à vérifier', label: 'E-mail à vérifier' },
]

const ROLE_LABELS = {
  supplier: 'Fournisseur',
  buyer: 'Porteur de projet',
  admin: 'Administrateur',
}

const STATUS_CLASSES = {
  actif: 'bg-emerald-50 text-emerald-800',
  suspendu: 'bg-rose-50 text-rose-800',
  désactivé: 'bg-slate-100 text-slate-700',
  'e-mail à vérifier': 'bg-amber-50 text-amber-800',
}

const MODES = {
  suspend: { title: 'Suspendre le compte', verb: 'Suspendre', needsReason: true },
  reactivate: { title: 'Réactiver le compte', verb: 'Réactiver', needsReason: false },
  delete: { title: 'Supprimer le compte', verb: 'Supprimer', needsReason: true },
}

/**
 * Gestion des comptes (SCRUM-71) : recherche, suspension, réactivation et
 * suppression douce. Chaque décision est motivée, auditée et notifiée.
 */
export default function AdminUsersPage() {
  const [filters, setFilters] = useState({ q: '', role: '', status: '', includeDeleted: false })
  const [draftQuery, setDraftQuery] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  const [action, setAction] = useState(null) // { mode, user }
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState(null)

  const load = useCallback(async (currentFilters, currentPage) => {
    setLoading(true)
    setError(null)
    try {
      const params = { page: currentPage, per_page: 20 }
      if (currentFilters.q) params.q = currentFilters.q
      if (currentFilters.role) params.role = currentFilters.role
      if (currentFilters.status) params.status = currentFilters.status
      if (currentFilters.includeDeleted) params.include_deleted = 1
      setData(await fetchAdminUsers(params))
    } catch (requestError) {
      setError(requestError.userMessage ?? 'Impossible de charger les comptes.')
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

  function changeFilter(field, value) {
    setPage(1)
    setFilters((current) => ({ ...current, [field]: value }))
  }

  function openAction(mode, user) {
    setAction({ mode, user })
    setReason('')
    setActionError(null)
    setNotice(null)
  }

  async function submitAction(event) {
    event.preventDefault()
    const { mode, user } = action
    const config = MODES[mode]

    if (config.needsReason && reason.trim().length < 5) {
      setActionError('Le motif doit contenir au moins 5 caractères.')
      return
    }

    setSubmitting(true)
    setActionError(null)
    try {
      const result =
        mode === 'suspend'
          ? await suspendUser(user.id, reason.trim())
          : mode === 'delete'
            ? await deleteUser(user.id, reason.trim())
            : await reactivateUser(user.id)

      setNotice(result?.message ?? 'Le compte a été mis à jour.')
      setAction(null)
      await load(filters, page)
    } catch (requestError) {
      setActionError(requestError.userMessage ?? "L'action a échoué.")
    } finally {
      setSubmitting(false)
    }
  }

  const users = data?.data ?? []
  const config = action ? MODES[action.mode] : null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestion des utilisateurs"
        subtitle="Recherchez un compte, suspendez-le ou réactivez-le. La suppression ferme immédiatement les sessions."
      />

      {notice && (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {notice}
        </p>
      )}

      <section className="card" aria-label="Filtres des utilisateurs">
        <form onSubmit={applySearch} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-ink">Recherche</span>
            <input
              type="search"
              value={draftQuery}
              onChange={(event) => setDraftQuery(event.target.value)}
              placeholder="Nom, e-mail ou téléphone"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-ink">Rôle</span>
            <select
              value={filters.role}
              onChange={(event) => changeFilter('role', event.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-ink">Statut</span>
            <select
              value={filters.status}
              onChange={(event) => changeFilter('status', event.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={filters.includeDeleted}
                onChange={(event) => changeFilter('includeDeleted', event.target.checked)}
                className="h-4 w-4 rounded border-line"
              />
              Comptes supprimés
            </label>
            <button type="submit" className="btn btn-primary">
              Filtrer
            </button>
          </div>
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

      {loading && !data && <p className="text-sm text-muted">Chargement des comptes…</p>}

      {data && (
        <section className="card" aria-labelledby="users-title">
          <h2 id="users-title" className="text-base font-semibold text-ink">
            {data.total ?? users.length} compte(s)
          </h2>

          {users.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Aucun compte ne correspond à ces critères.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line">
              {users.map((user) => (
                <li key={user.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-ink">{user.name}</p>
                      <span className="rounded-full bg-page px-2 py-0.5 text-xs font-medium text-muted">
                        {ROLE_LABELS[user.role] ?? user.role}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_CLASSES[user.status] ?? 'bg-page text-muted'
                        }`}
                      >
                        {user.status}
                      </span>
                      {user.deleted_at && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                          Supprimé
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {user.email}
                      {user.supplier_profile?.company_name ? ` · ${user.supplier_profile.company_name}` : ''}
                      {user.buyer_profile?.organization ? ` · ${user.buyer_profile.organization}` : ''}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    {!user.deleted_at && user.status !== 'suspendu' && (
                      <button type="button" className="btn btn-secondary" onClick={() => openAction('suspend', user)}>
                        Suspendre
                      </button>
                    )}
                    {!user.deleted_at && user.status !== 'actif' && (
                      <button type="button" className="btn btn-secondary" onClick={() => openAction('reactivate', user)}>
                        Réactiver
                      </button>
                    )}
                    {!user.deleted_at && (
                      <button type="button" className="btn btn-primary" onClick={() => openAction('delete', user)}>
                        Supprimer
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <Pagination currentPage={data.current_page} lastPage={data.last_page} onChange={setPage} className="mt-6" />
        </section>
      )}

      {action && config && (
        <Modal title={config.title} onClose={() => setAction(null)}>
          <form onSubmit={submitAction} className="space-y-4" noValidate>
            <p className="text-sm text-muted">
              Compte : <span className="font-medium text-ink">{action.user.name}</span> ({action.user.email})
            </p>

            {config.needsReason ? (
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-ink">Motif</span>
                <textarea
                  rows="3"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  maxLength={1000}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
                  placeholder="Expliquez la décision (visible par l'utilisateur)"
                />
              </label>
            ) : (
              <p className="text-sm text-muted">Le compte redeviendra actif et pourra se reconnecter.</p>
            )}

            {actionError && (
              <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-sm text-rose-800">
                {actionError}
              </p>
            )}

            <div className="flex justify-end gap-3">
              <button type="button" className="btn btn-secondary" onClick={() => setAction(null)}>
                Annuler
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? 'Traitement…' : config.verb}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
