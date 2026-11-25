import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { fetchMarketPrice } from '@/api/tenders'
import MarketPriceCard from './MarketPriceCard'

vi.mock('@/api/http', () => ({ http: { get: vi.fn() }, onAuthError: vi.fn() }))
vi.mock('@/api/tenders', () => ({ fetchMarketPrice: vi.fn() }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('MarketPriceCard (SCRUM-82)', () => {
  it('affiche la fourchette, le nombre de transactions et situe chaque devis', async () => {
    fetchMarketPrice.mockResolvedValue({
      status: 'ok',
      transactions: 4,
      min_transactions: 3,
      months: 12,
      category: 'Cartonnage',
      low: 1750,
      median: 2500,
      high: 3250,
      comment: 'La moitié des 4 transactions comparables se situe entre 1 750,00 TND et 3 250,00 TND.',
      simulated: true,
    })

    render(
      <MarketPriceCard
        tenderId={9}
        quotes={[
          { id: 1, amount: '1200.00', supplier: { company_name: 'Atlas' } },
          { id: 2, amount: '3000.00', supplier: { company_name: 'Djerba Pack' } },
        ]}
      />,
    )

    expect(await screen.findByText(/1\s750,00 TND – 3\s250,00 TND/)).toBeTruthy()
    expect(screen.getByText(/4 transactions comparables sur 12 mois/)).toBeTruthy()
    expect(screen.getByText(/sous la fourchette/)).toBeTruthy()
    expect(screen.getByText(/dans la fourchette/)).toBeTruthy()
    expect(screen.getByText(/Mode simulé, sans IA/)).toBeTruthy()
    expect(fetchMarketPrice).toHaveBeenCalledWith(9)
  })

  it('indique des données insuffisantes', async () => {
    fetchMarketPrice.mockResolvedValue({ status: 'insufficient', transactions: 1, min_transactions: 3, months: 12, category: 'Cartonnage' })

    render(<MarketPriceCard tenderId={9} />)

    expect(await screen.findByText(/Données insuffisantes : 1 transaction comparable/)).toBeTruthy()
  })

  it('reste discrète si l’estimation échoue', async () => {
    fetchMarketPrice.mockRejectedValue({ userMessage: 'Service indisponible.' })

    render(<MarketPriceCard tenderId={9} />)

    expect(await screen.findByText('Service indisponible.')).toBeTruthy()
  })
})
