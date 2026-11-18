import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { fetchProduct } from '@/api/products'
import { createBuyerOrder } from '@/api/orders'
import { useAuthStore } from '@/stores/auth'
import ProductDetailPage from './ProductDetailPage'

vi.mock('@/api/products', () => ({
  fetchProduct: vi.fn(),
}))

vi.mock('@/api/orders', () => ({
  createBuyerOrder: vi.fn(),
}))

function mockProductData() {
  return {
    product: {
      id: 42,
      supplier_id: 10,
      title: 'Scie circulaire Pro 1800W',
      description: 'Scie professionnelle haute précision pour chantiers.',
      price: '450.00',
      unit: 'pièce',
      stock: 5,
      availability_days: 2,
      category: { id: 3, name: 'Outillage électroportatif' },
      supplier: {
        id: 10,
        company_name: 'Quincaillerie Centrale SARL',
        logo: null,
        delivery_days: 3,
        payment_terms: 'Comptant à la livraison ou virement sous 30 jours',
      },
    },
    same_supplier_products: [
      {
        id: 43,
        supplier_id: 10,
        title: 'Lame de rechange 48 dents',
        price: '65.00',
        unit: 'pièce',
        stock: 20,
      },
    ],
  }
}

describe('ProductDetailPage (SCRUM-51 / F16)', () => {
  beforeEach(() => {
    vi.mocked(fetchProduct).mockResolvedValue(mockProductData())
    vi.mocked(createBuyerOrder).mockResolvedValue({
      message: 'Votre commande a été validée avec succès.',
      order: { id: 101 },
    })
    sessionStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    sessionStorage.clear()
  })

  it('affiche les détails du produit, le stock et les suggestions du même fournisseur', async () => {
    useAuthStore.setState({ user: null, token: null, loaded: true })

    render(
      <MemoryRouter initialEntries={['/produits/42']}>
        <Routes>
          <Route path="/produits/:id" element={<ProductDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Chargement de la fiche produit...')).toBeTruthy()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Scie circulaire Pro 1800W' })).toBeTruthy()
      expect(screen.getByText('Quincaillerie Centrale SARL')).toBeTruthy()
      expect(screen.getAllByText(/450\.00/).length).toBeGreaterThan(0)
      expect(screen.getByText('Lame de rechange 48 dents')).toBeTruthy()
    })
  })

  it('mémorise l’intention de commande et redirige vers la connexion si non connecté', async () => {
    useAuthStore.setState({ user: null, token: null, loaded: true })

    render(
      <MemoryRouter initialEntries={['/produits/42']}>
        <Routes>
          <Route path="/produits/:id" element={<ProductDetailPage />} />
          <Route path="/connexion" element={<div>Page de connexion</div>} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Scie circulaire Pro 1800W' })).toBeTruthy()
    })

    const orderButton = screen.getByRole('button', { name: 'Commander' })
    fireEvent.click(orderButton)

    await waitFor(() => {
      expect(screen.getByText('Page de connexion')).toBeTruthy()
    })

    const stored = JSON.parse(sessionStorage.getItem('pending_direct_order'))
    expect(stored).toEqual(
      expect.objectContaining({
        mainProductId: 42,
        mainQuantity: 1,
      }),
    )
  })

  it('ouvre la modale de récapitulatif pour un acheteur connecté avec la mention obligatoire', async () => {
    useAuthStore.setState({
      user: { id: 5, name: 'Acheteur Test', role: 'buyer' },
      token: 'buyer-token',
      loaded: true,
    })

    render(
      <MemoryRouter initialEntries={['/produits/42']}>
        <Routes>
          <Route path="/produits/:id" element={<ProductDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Scie circulaire Pro 1800W' })).toBeTruthy()
    })

    // Cocher le produit additionnel du même fournisseur
    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)

    const orderButton = screen.getByRole('button', { name: 'Commander' })
    fireEvent.click(orderButton)

    // Vérification de la modale de récapitulatif
    await waitFor(() => {
      expect(screen.getByText('Récapitulatif de votre commande')).toBeTruthy()
      expect(screen.getByText(/Aucun paiement en ligne — règlement selon les conditions du fournisseur/)).toBeTruthy()
      expect(screen.getByText('Confirmer la commande')).toBeTruthy()
    })
  })

  it('valide la commande directe et redirige vers /orders/:id', async () => {
    useAuthStore.setState({
      user: { id: 5, name: 'Acheteur Test', role: 'buyer' },
      token: 'buyer-token',
      loaded: true,
    })

    render(
      <MemoryRouter initialEntries={['/produits/42']}>
        <Routes>
          <Route path="/produits/:id" element={<ProductDetailPage />} />
          <Route path="/orders/:id" element={<div>Suivi de la commande créée</div>} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Scie circulaire Pro 1800W' })).toBeTruthy()
    })

    const orderButton = screen.getByRole('button', { name: 'Commander' })
    fireEvent.click(orderButton)

    await waitFor(() => {
      expect(screen.getByText('Confirmer la commande')).toBeTruthy()
    })

    const confirmButton = screen.getByRole('button', { name: 'Confirmer la commande' })
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(createBuyerOrder).toHaveBeenCalledWith({
        items: [{ product_id: 42, quantity: 1 }],
      })
      expect(screen.getByText('Suivi de la commande créée')).toBeTruthy()
    })
  })
})
