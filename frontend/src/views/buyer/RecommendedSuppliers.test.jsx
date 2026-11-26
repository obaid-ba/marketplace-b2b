import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { http } from '@/api/http'
import RecommendedSuppliers from './RecommendedSuppliers'

vi.mock('@/api/http', () => ({ http: { get: vi.fn() }, onAuthError: vi.fn() }))

function renderCard() {
  render(
    <MemoryRouter>
      <RecommendedSuppliers />
    </MemoryRouter>,
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('RecommendedSuppliers (SCRUM-87)', () => {
  it('affiche les fournisseurs recommandés avec la raison', async () => {
    http.get.mockResolvedValue({
      data: {
        data: [
          {
            id: 7,
            company_name: 'Atlas Emballages',
            logo_url: null,
            region: 'Sfax',
            categories: ['Cartonnage'],
            reason: 'Vous achetez en « Cartonnage » · note 4,6 / 5 sur 38 avis',
          },
        ],
      },
    })
    renderCard()

    expect(await screen.findByText('Atlas Emballages')).toBeTruthy()
    expect(screen.getByText('Vous achetez en « Cartonnage » · note 4,6 / 5 sur 38 avis')).toBeTruthy()
    expect(screen.getByRole('link').getAttribute('href')).toBe('/fournisseurs/7')
    expect(http.get).toHaveBeenCalledWith('/buyer/recommendations')
  })

  it('disparaît sans recommandation', async () => {
    http.get.mockResolvedValue({ data: { data: [] } })
    renderCard()

    await waitFor(() => expect(screen.queryByText('Fournisseurs recommandés')).toBeNull())
  })
})
