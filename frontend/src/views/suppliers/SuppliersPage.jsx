import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { fetchRegions } from '@/api/catalog'
import { fetchCategories } from '@/api/categories'
import { searchSuppliers } from '@/api/suppliers'
import EmptyState from '@/components/EmptyState'
import Pagination from '@/components/Pagination'
import { supplierPublicPath } from '@/router/paths'
import { formatRating } from '@/utils/format'
import { initialsOf } from '@/utils/initials'

const SORTS = [
  { value: 'rating', label: 'Mieux notés' },
  { value: 'products', label: 'Plus de produits' },
  { value: 'name', label: 'Nom (A → Z)' },
]

function SupplierCard({ supplier }) {
  return (
    <Link
      to={supplierPublicPath(supplier.id)}
      className="flex h-full flex-col rounded-xl border border-line bg-surface p-4 transition hover:border-brand-100 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-brand-100 focus-visible:outline-none"
    >
      <div className="flex items-center gap-3">
        {supplier.logo_url ? (
          <img src={supplier.logo_url} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" loading="lazy" />
        ) : (
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-50 font-semibold text-brand-600">
            {initialsOf(supplier.company_name)}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="truncate font-semibold text-ink">{supplier.company_name}</h2>
          <p className="truncate text-xs text-muted">{[supplier.sector, supplier.region].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-muted">{supplier.description}</p>
      {supplier.categories.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {supplier.categories.map((category) => (
            <li key={category} className="rounded-full bg-info-soft px-2.5 py-0.5 text-xs text-info">
              {category}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-auto flex items-center justify-between pt-4 text-sm">
        <span className="text-ink">
          {supplier.reviews_count > 0 ? (
            <>
              ★ {formatRating(supplier.rating_avg)} <span className="text-muted">({supplier.reviews_count} avis)</span>
            </>
          ) : (
            <span className="text-muted">Pas encore d’avis</span>
          )}
        </span>
        <span className="text-muted">
          {supplier.products_count} produit{supplier.products_count > 1 ? 's' : ''}
        </span>
      </p>
    </Link>
  )
}

/**
 * Annuaire public des fournisseurs : uniquement les fournisseurs validés et publiés. Recherche, région (siège ou
 * zone couverte), catégorie et tri sont gardés dans l'adresse (?q=…&region_id=…), pour partager une recherche.
 */
export default function SuppliersPage() {
  const [params, setParams] = useSearchParams()
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [regions, setRegions] = useState([])
  const [categories, setCategories] = useState([])
  const [search, setSearch] = useState(params.get('q') ?? '')

  const query = params.toString()

  useEffect(() => {
    fetchRegions().then(setRegions).catch(() => setRegions([]))
    fetchCategories().then(setCategories).catch(() => setCategories([]))
  }, [])

  useEffect(() => {
    let active = true
    setError(null)
    searchSuppliers(Object.fromEntries(new URLSearchParams(query)))
      .then((data) => active && setResult(data))
      .catch((err) => active && setError(err.userMessage ?? 'L’annuaire n’a pas pu être chargé.'))
    return () => {
      active = false
    }
  }, [query])

  function update(changes) {
    setParams((current) => {
      const next = new URLSearchParams(current)
      Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)))
      if (!('page' in changes)) next.delete('page')
      return next
    })
  }

  const suppliers = result?.data ?? []

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-[28px] font-bold text-ink sm:text-[32px]">Fournisseurs</h1>
      <p className="mt-1 text-muted">Des entreprises tunisiennes vérifiées par notre équipe avant d’apparaître ici.</p>

      <form
        className="mt-6 grid gap-3 rounded-xl border border-line bg-surface p-3 sm:grid-cols-[1fr_auto_auto_auto_auto]"
        onSubmit={(event) => {
          event.preventDefault()
          update({ q: search.trim() })
        }}
      >
        <label className="sr-only" htmlFor="supplier-search">
          Rechercher un fournisseur
        </label>
        <input
          id="supplier-search"
          className="input"
          placeholder="Nom, secteur, savoir-faire…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <label className="sr-only" htmlFor="supplier-region">
          Région
        </label>
        <select id="supplier-region" className="input" value={params.get('region_id') ?? ''} onChange={(event) => update({ region_id: event.target.value })}>
          <option value="">Toutes les régions</option>
          {regions.map((region) => (
            <option key={region.id} value={region.id}>
              {region.name}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="supplier-category">
          Catégorie
        </label>
        <select id="supplier-category" className="input" value={params.get('category_id') ?? ''} onChange={(event) => update({ category_id: event.target.value })}>
          <option value="">Toutes les catégories</option>
          {categories.map((root) => (
            <optgroup key={root.id} label={root.name}>
              <option value={root.id}>{root.name} (toute la catégorie)</option>
              {(root.children ?? []).map((child) => (
                <option key={child.id} value={child.id}>
                  {child.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <label className="sr-only" htmlFor="supplier-sort">
          Trier
        </label>
        <select id="supplier-sort" className="input" value={params.get('sort') ?? 'rating'} onChange={(event) => update({ sort: event.target.value === 'rating' ? '' : event.target.value })}>
          {SORTS.map((sort) => (
            <option key={sort.value} value={sort.value}>
              {sort.label}
            </option>
          ))}
        </select>
        <button type="submit" className="btn-primary">
          Rechercher
        </button>
      </form>

      {error ? (
        <EmptyState icon="!" title="Annuaire indisponible" description={error} />
      ) : !result ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Chargement des fournisseurs">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl bg-surface" />
          ))}
        </div>
      ) : suppliers.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="Aucun fournisseur ne correspond" description="Élargissez la région ou la catégorie, ou modifiez votre recherche." />
        </div>
      ) : (
        <>
          <p className="mt-6 text-sm text-muted">
            {result.meta.total} fournisseur{result.meta.total > 1 ? 's' : ''}
          </p>
          <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {suppliers.map((supplier) => (
              <li key={supplier.id}>
                <SupplierCard supplier={supplier} />
              </li>
            ))}
          </ul>
          <div className="mt-6 flex justify-center">
            <Pagination
              currentPage={result.meta.current_page}
              lastPage={result.meta.last_page}
              onChange={(value) => update({ page: value > 1 ? String(value) : '' })}
            />
          </div>
        </>
      )}
    </div>
  )
}
