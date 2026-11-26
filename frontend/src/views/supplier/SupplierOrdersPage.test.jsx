import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { fetchSupplierOrders } from '@/api/orders'
import { useAuthStore } from '@/stores/auth'
import SupplierOrdersPage from './SupplierOrdersPage'

vi.mock('@/api/orders', () => ({
  fetchSupplierOrders: vi.fn(),
  fetchOrderDocumentBlob: vi.fn(),
}))

function mockSupplierOrders() {
  return {
    data: [
      {
        id: 101,
        created_at: '2026-11-16T08:00:00+01:00',
        origin: 'catalogue',
        status: 'validée',
        total: '950.00',
        buyer: {
          id: 3,
          organization: 'Travaux Publics du Sud',
          user: {
            name: 'Mongi Trabelsi',
            email: 'mongi@tps.tn',
            phone: '71123456',
          },
        },
        items: [
          {
            id: 1,
            label: 'Marteau perforateur SDS-Plus',
            quantity: 2,
            unit_price: '475.00',
          },
        ],
        documents: [],
      },
    ],
    current_page: 1,
    last_page: 1,
    total: 1,
  }
}

describe('SupplierOrdersPage (SCRUM-58 / F16)', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { id: 10, name: 'Fournisseur SARL', role: 'supplier' },
      token: 'supplier-token',
      loaded: true,
    })
    vi.mocked(fetchSupplierOrders).mockResolvedValue(mockSupplierOrders())
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('affiche la liste des commandes reçues avec les détails du client et des articles', async () => {
    render(
      <MemoryRouter>
        <SupplierOrdersPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('Chargement des commandes reçues...')).toBeTruthy()

    await waitFor(() => {
      expect(screen.getByText('Commande #101')).toBeTruthy()
      expect(screen.getByText('Travaux Publics du Sud')).toBeTruthy()
      expect(screen.getByText(/Marteau perforateur SDS-Plus/)).toBeTruthy()
      expect(screen.getByText(/950.00/)).toBeTruthy()
    })

    expect(fetchSupplierOrders).toHaveBeenCalledWith('all', 1)
  })

  it('permet au fournisseur de filtrer ses commandes reçues par statut', async () => {
    render(
      <MemoryRouter>
        <SupplierOrdersPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Commande #101')).toBeTruthy()
    })

    const validatedTab = screen.getByRole('button', { name: 'Validée' })
    fireEvent.click(validatedTab)

    await waitFor(() => {
      expect(fetchSupplierOrders).toHaveBeenCalledWith('validée', 1)
    })
  })
})
