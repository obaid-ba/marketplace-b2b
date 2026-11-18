import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { fetchBuyerOrders } from '@/api/orders'
import { useAuthStore } from '@/stores/auth'
import BuyerOrdersPage from './BuyerOrdersPage'

vi.mock('@/api/orders', () => ({
  fetchBuyerOrders: vi.fn(),
  fetchOrderDocumentBlob: vi.fn(),
}))

function mockBuyerOrders() {
  return {
    data: [
      {
        id: 77,
        created_at: '2026-11-15T10:00:00+01:00',
        origin: 'catalogue',
        status: 'validée',
        total: '1250.00',
        supplier: {
          id: 10,
          company_name: 'Outillage Pro Tunisie',
          logo: null,
        },
        items: [
          {
            id: 1,
            label: 'Bétonnière Pro 350L',
            quantity: 1,
            unit_price: '1250.00',
          },
        ],
        documents: [],
      },
      {
        id: 78,
        created_at: '2026-11-14T14:30:00+01:00',
        origin: 'devis',
        status: 'expédiée',
        total: '3400.00',
        supplier: {
          id: 12,
          company_name: 'Matériaux Express',
          logo: null,
        },
        items: [
          {
            id: 2,
            label: 'Sable et Ciment en vrac',
            quantity: 2,
            unit_price: '1700.00',
          },
        ],
        documents: [
          {
            id: 99,
            type: 'facture',
            number: 'FAC-2026-0042',
            pdf_path: 'documents/orders/78/facture.pdf',
          },
        ],
      },
    ],
    current_page: 1,
    last_page: 1,
    total: 2,
  }
}

describe('BuyerOrdersPage (SCRUM-58 / F16)', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { id: 1, name: 'Acheteur SARL', role: 'buyer' },
      token: 'buyer-token',
      loaded: true,
    })
    vi.mocked(fetchBuyerOrders).mockResolvedValue(mockBuyerOrders())
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('affiche la liste des commandes avec statut, fournisseur, progression et documents', async () => {
    render(
      <MemoryRouter>
        <BuyerOrdersPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('Chargement de vos commandes...')).toBeTruthy()

    await waitFor(() => {
      expect(screen.getByText('Commande #77')).toBeTruthy()
      expect(screen.getByText('Outillage Pro Tunisie')).toBeTruthy()
      expect(screen.getByText('Commande #78')).toBeTruthy()
      expect(screen.getByText('Matériaux Express')).toBeTruthy()
      expect(screen.getByText(/Facture #FAC-2026-0042/)).toBeTruthy()
    })

    expect(fetchBuyerOrders).toHaveBeenCalledWith('all', 1)
  })

  it('permet de filtrer les commandes par onglet de statut', async () => {
    render(
      <MemoryRouter>
        <BuyerOrdersPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Commande #77')).toBeTruthy()
    })

    const expédieeTab = screen.getByRole('button', { name: 'Expédiée' })
    fireEvent.click(expédieeTab)

    await waitFor(() => {
      expect(fetchBuyerOrders).toHaveBeenCalledWith('expédiée', 1)
    })
  })
})
