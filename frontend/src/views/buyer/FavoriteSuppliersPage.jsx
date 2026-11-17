import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { addFavoriteSupplier, fetchFavoriteSuppliers, removeFavoriteSupplier } from '@/api/favorites'
import EmptyState from '@/components/EmptyState'
import { HeartIcon } from '@/components/FavoriteButton'
import { PATHS, supplierPublicPath } from '@/router/paths'
import { formatRating } from '@/utils/format'
import { initialsOf } from '@/utils/initials'

/**
 * Fournisseurs favoris (SCRUM-39, maquette B8) : ouvrir la fiche, retirer (avec « Annuler » pendant 5 s).
 * « Inviter à une demande » (S3) et « Contacter » (S5) arrivent dans les prochains sprints.
 */
export const UNDO_DELAY_MS = 5000

function SupplierAvatar({ supplier }) {
  return supplier.logo_url ? (
    <img src={supplier.logo_url} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
  ) : (
    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-50 text-base font-bold text-brand-600">
      {initialsOf(supplier.company_name)}
    </span>
  )
}

export default function FavoriteSuppliersPage() {
  const [suppliers, setSuppliers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [undo, setUndo] = useState(null) // { supplier, index }
  const [notice, setNotice] = useState(null)
  const timer = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setSuppliers(await fetchFavoriteSuppliers())
    } catch (err) {
      setError(err.userMessage ?? 'Impossible de charger vos favoris.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    return () => clearTimeout(timer.current)
  }, [load])

  async function remove(supplier) {
    const index = suppliers.findIndex((s) => s.id === supplier.id)
    setSuppliers((list) => list.filter((s) => s.id !== supplier.id))
    setNotice(null)
    clearTimeout(timer.current)
    try {
      await removeFavoriteSupplier(supplier.id)
      setUndo({ supplier, index })
      timer.current = setTimeout(() => setUndo(null), UNDO_DELAY_MS)
    } catch (err) {
      setSuppliers((list) => [...list.slice(0, index), supplier, ...list.slice(index)])
      setNotice(err.userMessage ?? 'Le retrait a échoué.')
    }
  }

  async function cancelRemoval() {
    if (!undo) return
    const { supplier, index } = undo
    clearTimeout(timer.current)
    setUndo(null)
    setSuppliers((list) => [...list.slice(0, index), supplier, ...list.slice(index)])
    try {
      await addFavoriteSupplier(supplier.id)
    } catch (err) {
      setSuppliers((list) => list.filter((s) => s.id !== supplier.id))
      setNotice(err.userMessage ?? 'Impossible de rétablir ce favori.')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink sm:text-[28px]">Fournisseurs favoris</h1>
        <p className="mt-1 text-sm text-muted">Retrouvez vos fournisseurs de confiance et invitez-les à vos demandes</p>
      </div>

      {notice && (
        <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">
          {notice}
        </p>
      )}

      {error ? (
        <EmptyState
          icon="!"
          title="Vos favoris n'ont pas pu être chargés"
          description={error}
          action={
            <button type="button" className="btn-primary" onClick={load}>
              Réessayer
            </button>
          }
        />
      ) : loading ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Chargement des favoris">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : suppliers.length === 0 ? (
        <EmptyState
          icon="♡"
          title="Vous n'avez pas encore de fournisseur favori"
          description="Ajoutez des fournisseurs à vos favoris depuis leur fiche ou la fiche d'un produit."
          action={
            <Link to={PATHS.catalog} className="btn-primary">
              Parcourir le catalogue
            </Link>
          }
        />
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {suppliers.map((supplier) => (
            <li key={supplier.id} className="flex flex-col rounded-xl border border-line bg-surface p-5">
              <div className="flex items-start gap-3">
                <SupplierAvatar supplier={supplier} />
                <div className="min-w-0 flex-1">
                  <Link
                    to={supplierPublicPath(supplier.id)}
                    className="block truncate text-[17px] font-semibold text-ink hover:text-brand-600"
                  >
                    {supplier.company_name}
                  </Link>
                  <p className="text-xs text-muted">
                    {[supplier.region, supplier.rating_avg > 0 ? `★ ${formatRating(supplier.rating_avg)}` : null]
                      .filter(Boolean)
                      .join(' - ')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(supplier)}
                  aria-label={`Retirer « ${supplier.company_name} » des favoris`}
                  title="Retirer des favoris"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-danger hover:bg-danger-soft"
                >
                  <HeartIcon filled className="h-5 w-5" />
                </button>
              </div>

              {supplier.categories.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-2" aria-label="Catégories">
                  {supplier.categories.map((name) => (
                    <li key={name} className="rounded-full bg-page px-2.5 py-1 text-xs text-muted">
                      {name}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-auto flex flex-wrap gap-2 pt-5">
                <button type="button" className="btn-primary px-5 py-2.5 font-semibold" disabled title="Bientôt disponible">
                  Inviter à une demande
                </button>
                <button type="button" className="btn-secondary px-5 py-2.5 font-semibold" disabled title="Bientôt disponible">
                  Contacter
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {undo && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-md items-center justify-between gap-4 rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-lg"
        >
          <span>« {undo.supplier.company_name} » retiré de vos favoris.</span>
          <button type="button" className="font-semibold text-brand-100 hover:text-white" onClick={cancelRemoval}>
            Annuler
          </button>
        </div>
      )}
    </div>
  )
}
