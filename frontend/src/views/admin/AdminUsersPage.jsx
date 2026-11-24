import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { fetchAdminUsers } from '@/api/adminUsers'
import EmptyState from '@/components/EmptyState'
import PageHeader from '@/components/PageHeader'
import Pagination from '@/components/Pagination'
import StatusBadge from '@/components/StatusBadge'
import { adminUserPath } from '@/router/paths'
import { formatRelativeDate } from '@/utils/relativeDate'
import { ROLES, ROLE_LABELS } from '@/utils/roles'
import { USER_STATUS, userStatusConfig } from '@/utils/userStatus'

const SORTS = [
  { value: '', label: 'Inscription récente' },
  { value: 'last_login', label: 'Connexion récente' },
  { value: 'name', label: 'Nom' },
]

/** Utilisateurs (SCRUM-118 / F24). Filtres conservés dans l'adresse. */
export default function AdminUsersPage() {
  const [params, setParams] = useSearchParams()
  const role = params.get('role') ?? ''
  const status = params.get('statut') ?? ''
  const search = params.get('q') ?? ''
  const sort = params.get('tri') ?? ''
  const page = Math.max(1, Number(params.get('page')) || 1)

  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [text, setText] = useState(search)
  const latest = useRef(0)

  const load = useCallback(async () => {
    const request = ++latest.current
    try {
      const data = await fetchAdminUsers({
        role: role || undefined,
        status: status || undefined,
        search: search || undefined,
        sort: sort || undefined,
        page,
      })
      if (request !== latest.current) return
      setResult(data)
      setError(null)
    } catch (err) {
      if (request === latest.current) setError(err.userMessage ?? 'Impossible de charger les utilisateurs.')
    }
  }, [page, role, search, sort, status])

  useEffect(() => {
    load()
  }, [load])

  function update(changes) {
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (!('page' in changes)) next.delete('page')
      Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)))
      return next
    })
  }

  const label = (value) => {
    const count = result?.counts?.[value]
    return `${userStatusConfig(value).label}${count === undefined ? '' : ` (${count})`}`
  }

  return (
    <>
      <PageHeader title="Utilisateurs" subtitle="Consultez les comptes, suspendez ou réactivez un accès." />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <form
          role="search"
          className="flex w-full gap-2 sm:w-auto"
          onSubmit={(event) => {
            event.preventDefault()
            update({ q: text.trim() })
          }}
        >
          <input
            type="search"
            className="input sm:w-72"
            placeholder="Nom, e-mail, téléphone, société…"
            aria-label="Rechercher un utilisateur"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <button type="submit" className="btn-secondary">
            Rechercher
          </button>
        </form>
        <select className="input w-auto" aria-label="Rôle" value={role} onChange={(event) => update({ role: event.target.value })}>
          <option value="">Tous les rôles</option>
          {Object.values(ROLES).map((value) => (
            <option key={value} value={value}>
              {ROLE_LABELS[value]}
            </option>
          ))}
        </select>
        <select className="input w-auto" aria-label="Statut" value={status} onChange={(event) => update({ statut: event.target.value })}>
          <option value="">Tous les statuts</option>
          {Object.values(USER_STATUS).map((value) => (
            <option key={value} value={value}>
              {label(value)}
            </option>
          ))}
        </select>
        <select className="input w-auto" aria-label="Tri" value={sort} onChange={(event) => update({ tri: event.target.value })}>
          {SORTS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div role="alert" className="card mb-4 border-danger-soft bg-danger-soft/40 text-sm text-danger">
          {error}{' '}
          <button type="button" className="font-medium underline" onClick={load}>
            Réessayer
          </button>
        </div>
      )}
      {!result && !error && <div className="card text-sm text-muted">Chargement des utilisateurs…</div>}
      {result?.data.length === 0 && <EmptyState title="Aucun utilisateur" description="Aucun compte ne correspond à ces critères." />}

      {result?.data.length > 0 && (
        <>
          <p className="mb-2 text-sm text-muted">
            {result.meta.total} compte{result.meta.total > 1 ? 's' : ''}
          </p>
          <ul className="space-y-2">
            {result.data.map((user) => {
              const config = userStatusConfig(user.status)
              return (
                <li key={user.id}>
                  <Link
                    to={adminUserPath(user.id)}
                    className="flex flex-col gap-2 rounded-xl border border-line bg-surface px-4 py-3 transition hover:border-brand-100 hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-ink">{user.name}</span>
                        <StatusBadge variant={config.variant}>{config.label}</StatusBadge>
                        <span className="text-xs text-muted">{user.role_label}</span>
                      </span>
                      <span className="mt-1 block truncate text-sm text-muted">
                        {[user.organization, user.email].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted sm:text-right">
                      {user.last_login_at ? `Connexion : ${formatRelativeDate(user.last_login_at)}` : 'Jamais connecté'}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
          <Pagination
            className="mt-6"
            currentPage={result.meta.current_page}
            lastPage={result.meta.last_page}
            onChange={(value) => update({ page: String(value) })}
          />
        </>
      )}
    </>
  )
}
