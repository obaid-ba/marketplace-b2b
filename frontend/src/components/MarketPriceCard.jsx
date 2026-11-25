import { useEffect, useState } from 'react'
import { fetchMarketPrice } from '@/api/tenders'
import { formatAmount } from '@/utils/money'

const money = (value) => formatAmount(Number(value).toFixed(2))

/**
 * « Prix habituel du marché » sur la page Comparer les devis (SCRUM-82 / F31) : fourchette calculée à partir
 * des transactions comparables de la catégorie, avec leur nombre. Un repère pour juger un devis, pas un verdict.
 * quotes : devis affichés, pour situer chacun par rapport à la fourchette.
 */
export default function MarketPriceCard({ tenderId, quotes = [] }) {
  const [state, setState] = useState({ status: 'loading' })

  useEffect(() => {
    let active = true
    setState({ status: 'loading' })
    fetchMarketPrice(tenderId)
      .then((data) => active && setState(data))
      .catch((err) =>
        active && setState({ status: 'failed', message: err.response?.data?.message ?? err.userMessage ?? 'Estimation indisponible.' }),
      )
    return () => {
      active = false
    }
  }, [tenderId])

  return (
    <section aria-labelledby="market-price-title" className="card mb-6">
      <h2 id="market-price-title" className="text-base font-semibold text-ink">
        Prix habituel du marché
      </h2>

      {state.status === 'loading' && <div className="mt-3 h-10 animate-pulse rounded-lg bg-page" aria-label="Estimation en cours" />}

      {state.status === 'failed' && <p className="mt-2 text-sm text-muted">{state.message}</p>}

      {state.status === 'insufficient' && (
        <p className="mt-2 text-sm text-muted">
          Données insuffisantes : {state.transactions} transaction{state.transactions > 1 ? 's' : ''} comparable
          {state.transactions > 1 ? 's' : ''} sur les {state.months} derniers mois dans « {state.category} » (il en faut au moins{' '}
          {state.min_transactions}).
        </p>
      )}

      {state.status === 'ok' && (
        <>
          <p className="mt-2 text-2xl font-bold text-ink">
            {money(state.low)} – {money(state.high)}
          </p>
          <p className="text-sm text-muted">
            Médiane {money(state.median)} · {state.transactions} transactions comparables sur {state.months} mois dans «{' '}
            {state.category} »
          </p>
          <p className="mt-2 text-sm text-ink">{state.comment}</p>

          {quotes.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm">
              {quotes.map((quote) => {
                const amount = Number(quote.amount)
                const position =
                  amount < state.low ? 'sous la fourchette' : amount > state.high ? 'au-dessus de la fourchette' : 'dans la fourchette'
                return (
                  <li key={quote.id} className="flex flex-wrap justify-between gap-2">
                    <span className="text-ink">{quote.supplier?.company_name ?? `Devis n° ${quote.id}`}</span>
                    <span className={position === 'dans la fourchette' ? 'text-success' : 'text-accent'}>
                      {money(amount)} · {position}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}

          <p className="mt-3 text-xs text-muted">
            {state.simulated ? 'Mode simulé, sans IA' : 'Estimation IA'} — un repère calculé sur l’historique de la plateforme,
            pas une recommandation.
          </p>
        </>
      )}
    </section>
  )
}
