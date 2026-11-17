import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { fetchCategories } from '@/api/categories'
import { deleteSupplierProduct, fetchSupplierProducts, unpublishSupplierProduct } from '@/api/supplierProducts'
import EmptyState from '@/components/EmptyState'
import Modal from '@/components/Modal'
import Pagination from '@/components/Pagination'
import StatusBadge from '@/components/StatusBadge'
import { PATHS, supplierProductEditPath } from '@/router/paths'
import { formatNumber, formatPriceWithUnit } from '@/utils/format'

/**
 * Mes produits (SCRUM-34, maquette F2) : onglets par statut avec compteurs, filtre catégorie,
 * tableau (cartes sur mobile), actions Modifier / Voir le motif, menu « … » Dépublier / Supprimer.
 */

const TABS = [
  { value: '', label: 'Tous', count: 'all' },
  { value: 'published', label: 'Publiés', count: 'published' },
  { value: 'draft', label: 'Brouillons', count: 'draft' },
  { value: 'withdrawn', label: 'Retirés', count: 'withdrawn' },
]

const STATUS = {
  published: { variant: 'success', label: 'Publié' },
  draft: { variant: 'neutral', label: 'Brouillon' },
  withdrawn: { variant: 'danger', label: 'Retiré' },
}

function ActionsMenu({ product, onUnpublish, onDelete }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const close = (event) => {
      if (event.type === 'keydown' ? event.key === 'Escape' : !ref.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="btn-secondary h-10 w-10 px-0"
        aria-label={`Autres actions pour « ${product.title} »`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        …
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-10 mt-1 w-44 rounded-lg border border-line bg-surface py-1 shadow-lg">
          {product.status === 'published' && (
            <button
              type="button"
              role="menuitem"
              className="block w-full px-4 py-2 text-left text-sm text-ink hover:bg-page"
              onClick={() => {
                setOpen(false)
                onUnpublish(product)
              }}
            >
              Dépublier
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className="block w-full px-4 py-2 text-left text-sm text-danger hover:bg-danger-soft"
            onClick={() => {
              setOpen(false)
              onDelete(product)
            }}
          >
            Supprimer
          </button>
        </div>
      )}
    </div>
  )
}

function PrimaryAction({ product, onShowReason }) {
  return product.status === 'withdrawn' ? (
    <button type="button" className="btn-secondary h-10 px-4 font-semibold" onClick={() => onShowReason(product)}>
      Voir le motif
    </button>
  ) : (
    <Link
      to={supplierProductEditPath(product.id)}
      className="btn-secondary h-10 px-4 font-semibold"
      aria-label={`Modifier « ${product.title} »`}
    >
      Modifier
    </Link>
  )
}

const priceOf = (product) => formatPriceWithUnit(product.price, product.unit)
const stockOf = (product) => (product.type === 'service' || product.stock === null ? '—' : formatNumber(product.stock))

export default function MyProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const status = searchParams.get('status') ?? ''
  const categoryId = searchParams.get('category_id') ?? ''
  const page = Number(searchParams.get('page')) || 1

  const [result, setResult] = useState(null)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [reasonFor, setReasonFor] = useState(null)
  const [deleting, setDeleting] = useState(null) // produit à confirmer
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setResult(
        await fetchSupplierProducts({
          ...(status && { status }),
          ...(categoryId && { category_id: categoryId }),
          ...(page > 1 && { page }),
        }),
      )
    } catch (err) {
      setError(err.userMessage ?? 'Impossible de charger vos produits.')
    } finally {
      setLoading(false)
    }
  }, [status, categoryId, page])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => setCategories([]))
  }, [])

  function setParam(changes) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)))
      if (!('page' in changes)) next.delete('page')
      return next
    })
  }

  async function unpublish(product) {
    setNotice(null)
    try {
      const data = await unpublishSupplierProduct(product.id)
      setNotice({ type: 'success', text: data.message })
      await load()
    } catch (err) {
      setNotice({ type: 'error', text: err.userMessage ?? 'La dépublication a échoué.' })
    }
  }

  async function confirmDelete() {
    setBusy(true)
    setNotice(null)
    try {
      const data = await deleteSupplierProduct(deleting.id)
      setNotice({ type: 'success', text: data.message })
      setDeleting(null)
      // Dernier produit de la page : revenir à la page précédente.
      if (result?.data?.length === 1 && page > 1) setParam({ page: String(page - 1) })
      else await load()
    } catch (err) {
      setNotice({ type: 'error', text: err.userMessage ?? 'La suppression a échoué.' })
      setDeleting(null)
    } finally {
      setBusy(false)
    }
  }

  const products = result?.data ?? []
  const counts = result?.counts ?? {}
  const meta = result?.meta

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink sm:text-[28px]">Mes produits</h1>
          <p className="mt-1 text-sm text-muted">Gérez votre catalogue : publication, stock et visibilité</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn-secondary px-5 py-2.5 font-semibold" disabled title="Bientôt disponible">
            Importer
          </button>
          <Link to={PATHS.supplierProductNew} className="btn-primary px-5 py-2.5 font-semibold">
            Ajouter un produit
          </Link>
        </div>
      </div>

      {notice && (
        <p
          role={notice.type === 'error' ? 'alert' : 'status'}
          className={`rounded-lg px-4 py-3 text-sm ${
            notice.type === 'error' ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success'
          }`}
        >
          {notice.text}
        </p>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line">
        <div role="tablist" aria-label="Statut" className="-mb-px flex gap-6 overflow-x-auto">
          {TABS.map((tab) => {
            const active = status === tab.value
            return (
              <button
                key={tab.label}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setParam({ status: tab.value })}
                className={`border-b-2 pb-3 text-[15px] whitespace-nowrap transition ${
                  active ? 'border-brand-600 font-semibold text-brand-600' : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                {tab.label} ({counts[tab.count] ?? 0})
              </button>
            )
          })}
        </div>
        <label className="mb-3 flex items-center gap-2 text-sm">
          <span className="text-muted">Catégorie</span>
          <select
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"
            value={categoryId}
            onChange={(event) => setParam({ category_id: event.target.value })}
          >
            <option value="">Toutes</option>
            {categories.map((root) => (
              <optgroup key={root.id} label={root.name}>
                <option value={root.id}>{root.name} (toute la catégorie)</option>
                {root.children.map((child) => (
                  <option key={child.id} value={child.id}>
                    {child.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <EmptyState
          icon="!"
          title="Vos produits n'ont pas pu être chargés"
          description={error}
          action={
            <button type="button" className="btn-primary" onClick={load}>
              Réessayer
            </button>
          }
        />
      ) : loading && !result ? (
        <div className="space-y-2" aria-busy="true" aria-label="Chargement des produits">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          title={counts.all ? 'Aucun produit dans cette sélection' : 'Vous n’avez pas encore de produit'}
          description={counts.all ? 'Changez d’onglet ou de catégorie.' : 'Ajoutez votre premier produit ou service pour apparaître dans le catalogue.'}
          action={
            <Link to={PATHS.supplierProductNew} className="btn-primary">
              Ajouter un produit
            </Link>
          }
        />
      ) : (
        <>
          {/* Tableau : grand écran */}
          <div className="hidden overflow-x-auto rounded-xl border border-line bg-surface md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-page text-xs font-medium text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3">Produit</th>
                  <th scope="col" className="px-4 py-3">Catégorie</th>
                  <th scope="col" className="px-4 py-3">Prix</th>
                  <th scope="col" className="px-4 py-3">Stock</th>
                  <th scope="col" className="px-4 py-3">Vues</th>
                  <th scope="col" className="px-4 py-3">Statut</th>
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="border-t border-line">
                    <td className="max-w-64 truncate px-4 py-4 font-medium text-ink">{product.title}</td>
                    <td className="px-4 py-4 text-muted">{product.category?.name ?? '—'}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-ink">{priceOf(product)}</td>
                    <td className="px-4 py-4 text-ink">{stockOf(product)}</td>
                    <td className="px-4 py-4 text-ink">{formatNumber(product.views_count)}</td>
                    <td className="px-4 py-4">
                      <StatusBadge variant={STATUS[product.status]?.variant}>{STATUS[product.status]?.label}</StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <PrimaryAction product={product} onShowReason={setReasonFor} />
                        <ActionsMenu product={product} onUnpublish={unpublish} onDelete={setDeleting} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cartes : mobile */}
          <ul className="space-y-3 md:hidden">
            {products.map((product) => (
              <li key={product.id} className="rounded-xl border border-line bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{product.title}</p>
                    <p className="text-xs text-muted">{product.category?.name ?? '—'}</p>
                  </div>
                  <StatusBadge variant={STATUS[product.status]?.variant}>{STATUS[product.status]?.label}</StatusBadge>
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-muted">Prix</dt>
                    <dd className="text-ink">{priceOf(product)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Stock</dt>
                    <dd className="text-ink">{stockOf(product)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Vues</dt>
                    <dd className="text-ink">{formatNumber(product.views_count)}</dd>
                  </div>
                </dl>
                <div className="mt-3 flex justify-end gap-2">
                  <PrimaryAction product={product} onShowReason={setReasonFor} />
                  <ActionsMenu product={product} onUnpublish={unpublish} onDelete={setDeleting} />
                </div>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-muted">
              Affichage {meta.from} à {meta.to} sur {formatNumber(meta.total)} {meta.total > 1 ? 'produits' : 'produit'}
            </p>
            <Pagination
              currentPage={meta.current_page}
              lastPage={meta.last_page}
              onChange={(value) => setParam({ page: value > 1 ? String(value) : '' })}
            />
          </div>
        </>
      )}

      {reasonFor && (
        <Modal
          title={`Motif du retrait de « ${reasonFor.title} »`}
          onClose={() => setReasonFor(null)}
          actions={
            <button type="button" className="btn-primary" onClick={() => setReasonFor(null)}>
              Fermer
            </button>
          }
        >
          <p className="text-ink">{reasonFor.withdrawal_reason || 'Aucun motif précisé.'}</p>
          <p className="mt-3">
            Ce produit a été retiré du catalogue par l’administrateur. Vous pouvez corriger ses informations, mais il ne
            peut pas être republié.
          </p>
          <Link to={supplierProductEditPath(reasonFor.id)} className="mt-3 inline-block font-medium text-brand-600 hover:underline">
            Modifier le produit
          </Link>
        </Modal>
      )}

      {deleting && (
        <Modal
          title={`Supprimer « ${deleting.title} » ?`}
          onClose={() => !busy && setDeleting(null)}
          actions={
            <>
              <button type="button" className="btn-secondary" onClick={() => setDeleting(null)} disabled={busy}>
                Annuler
              </button>
              <button type="button" className="btn bg-danger font-semibold text-white hover:bg-danger/90" onClick={confirmDelete} disabled={busy}>
                {busy ? 'Suppression…' : 'Supprimer'}
              </button>
            </>
          }
        >
          Le produit disparaîtra du catalogue et de vos produits. S’il a déjà été commandé, il est conservé dans
          l’historique des commandes.
        </Modal>
      )}
    </div>
  )
}
