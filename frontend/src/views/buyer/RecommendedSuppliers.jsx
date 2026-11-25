import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { http } from '@/api/http'
import { initialsOf } from '@/utils/initials'
import { supplierPublicPath } from '@/router/paths'

/**
 * Fournisseurs recommandés selon les achats passés (SCRUM-87), sur le tableau de bord porteur.
 * Chaque carte indique la raison de la recommandation. Favoris et fournisseurs déjà sollicités sont exclus côté API.
 */
export default function RecommendedSuppliers() {
  const [state, setState] = useState({ status: 'loading', data: [] })

  useEffect(() => {
    let active = true
    http
      .get('/buyer/recommendations')
      .then(({ data }) => active && setState({ status: 'ready', data: data.data }))
      .catch(() => active && setState({ status: 'failed', data: [] }))
    return () => {
      active = false
    }
  }, [])

  // Recommandations indisponibles : la carte disparaît, le reste du tableau de bord reste utilisable.
  if (state.status === 'failed' || (state.status === 'ready' && state.data.length === 0)) return null

  return (
    <section className="card" aria-labelledby="recommended-title">
      <h2 id="recommended-title" className="text-base font-semibold text-ink">
        Fournisseurs recommandés
      </h2>
      <p className="mt-1 text-sm text-muted">Selon vos achats passés et les notes des fournisseurs</p>

      {state.status === 'loading' ? (
        <div className="mt-4 h-20 animate-pulse rounded-lg bg-page" aria-label="Chargement des recommandations" />
      ) : (
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {state.data.map((supplier) => (
            <li key={supplier.id}>
              <Link
                to={supplierPublicPath(supplier.id)}
                className="flex h-full items-start gap-3 rounded-xl border border-line p-3 transition hover:border-brand-100 hover:shadow-sm"
              >
                {supplier.logo_url ? (
                  <img src={supplier.logo_url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                ) : (
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-sm font-semibold text-brand-600">
                    {initialsOf(supplier.company_name)}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink">{supplier.company_name}</span>
                  <span className="block truncate text-xs text-muted">
                    {[supplier.region, ...supplier.categories].filter(Boolean).join(' · ')}
                  </span>
                  <span className="mt-1 block text-xs text-brand-600">{supplier.reason}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
