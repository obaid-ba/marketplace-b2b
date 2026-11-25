import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { fetchAuditLogs } from '@/api/auditLogs'
import EmptyState from '@/components/EmptyState'
import PageHeader from '@/components/PageHeader'
import Pagination from '@/components/Pagination'
import { adminDisputePath, adminUserPath, PATHS } from '@/router/paths'

const ACTIONS = {
  'supplier.validated': 'Fournisseur validé',
  'supplier.rejected': 'Fournisseur refusé',
  'user.suspended': 'Compte suspendu',
  'user.reactivated': 'Compte réactivé',
  'user.deleted': 'Compte supprimé',
  'product.withdrawn': 'Annonce retirée',
  'review.kept': 'Avis conservé',
  'review.hidden': 'Avis masqué',
  'dispute.taken': 'Litige pris en charge',
  'dispute.reassigned': 'Litige repris',
  'dispute.decided': 'Litige décidé',
  'category.created': 'Catégorie créée',
  'category.updated': 'Catégorie modifiée',
  'category.moved': 'Catégorie déplacée',
  'category.deleted': 'Catégorie supprimée',
}

const TARGETS = {
  user: 'Utilisateur',
  supplier_profile: 'Fournisseur',
  product: 'Produit',
  review: 'Avis',
  dispute: 'Litige',
  category: 'Catégorie',
}

const actionLabel = (action) => ACTIONS[action] ?? action

const formatDateTime = (value) =>
  new Date(value).toLocaleString('fr-FR', { timeZone: 'Africa/Tunis', dateStyle: 'short', timeStyle: 'short' })

/** Cible de l'action, avec un lien quand une page existe. */
function Target({ value }) {
  const [type, id] = String(value ?? '').split(':')
  const label = `${TARGETS[type] ?? type} n° ${id}`
  const path = { user: adminUserPath(id), dispute: adminDisputePath(id) }[type]
  return path ? (
    <Link to={path} className="text-brand-600 hover:underline">
      {label}
    </Link>
  ) : (
    label
  )
}

const FILTERS = { action: 'action', target: 'cible', admin_id: 'admin', from: 'du', to: 'au' }

/** Journal des actions des administrateurs (SCRUM-76) : consultation filtrable, aucune modification possible. */
export default function AdminAuditPage() {
  const [params, setParams] = useSearchParams()
  const query = params.toString()
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    const search = new URLSearchParams(query)
    const request = { page: Math.max(1, Number(search.get('page')) || 1) }
    Object.entries(FILTERS).forEach(([name, key]) => {
      if (search.get(key)) request[name] = search.get(key)
    })

    fetchAuditLogs(request)
      .then((data) => {
        if (!active) return
        setResult(data)
        setError(null)
      })
      .catch((err) => active && setError(err.userMessage ?? 'Impossible de charger le journal.'))
    return () => {
      active = false
    }
  }, [query])

  const get = (name) => params.get(FILTERS[name]) ?? ''

  function update(name, value) {
    setParams((current) => {
      const next = new URLSearchParams(current)
      next.delete('page')
      if (value) next.set(FILTERS[name], value)
      else next.delete(FILTERS[name])
      return next
    })
  }

  function goTo(page) {
    setParams((current) => {
      const next = new URLSearchParams(current)
      next.set('page', String(page))
      return next
    })
  }

  return (
    <>
      <PageHeader title="Journal d'audit" subtitle="Toutes les décisions des administrateurs. Ce journal ne peut pas être modifié." />

      <section aria-label="Filtres" className="card mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-ink">Action</span>
          <select className="input" value={get('action')} onChange={(event) => update('action', event.target.value)}>
            <option value="">Toutes</option>
            {(result?.actions ?? []).map((action) => (
              <option key={action} value={action}>
                {actionLabel(action)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-ink">Cible</span>
          <select className="input" value={get('target')} onChange={(event) => update('target', event.target.value)}>
            <option value="">Toutes</option>
            {Object.entries(TARGETS).map(([type, label]) => (
              <option key={type} value={`${type}:`}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-ink">Administrateur</span>
          <select className="input" value={get('admin_id')} onChange={(event) => update('admin_id', event.target.value)}>
            <option value="">Tous</option>
            {(result?.admins ?? []).map((admin) => (
              <option key={admin.id} value={admin.id}>
                {admin.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-ink">Du</span>
          <input type="date" className="input" value={get('from')} onChange={(event) => update('from', event.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-ink">Au</span>
          <input type="date" className="input" value={get('to')} onChange={(event) => update('to', event.target.value)} />
        </label>
      </section>

      {error && (
        <p role="alert" className="card mb-4 text-sm text-danger">
          {error}
        </p>
      )}
      {!result && !error && <p className="card text-sm text-muted">Chargement du journal…</p>}
      {result?.data.length === 0 && <EmptyState title="Aucune action" description="Aucune décision ne correspond à ces filtres." />}

      {result?.data.length > 0 && (
        <div className="card">
          <ul className="divide-y divide-line">
            {result.data.map((entry) => (
              <li key={entry.id} className="py-3 text-sm first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-ink">
                    <span className="font-medium">{actionLabel(entry.action)}</span> · <Target value={entry.target} />
                  </p>
                  <p className="text-xs text-muted">
                    {formatDateTime(entry.created_at)} · {entry.admin?.name ?? 'Administrateur supprimé'}
                  </p>
                </div>
                {entry.reason && <p className="mt-1 [overflow-wrap:anywhere] whitespace-pre-line text-muted">{entry.reason}</p>}
              </li>
            ))}
          </ul>
          <Pagination currentPage={result.meta.current_page} lastPage={result.meta.last_page} onChange={goTo} className="mt-6" />
        </div>
      )}

      <p className="mt-4 text-sm text-muted">
        L&apos;historique d&apos;un compte est aussi sur sa fiche, dans{' '}
        <Link to={PATHS.adminUsers} className="text-brand-600 hover:underline">
          Utilisateurs
        </Link>
        .
      </p>
    </>
  )
}
