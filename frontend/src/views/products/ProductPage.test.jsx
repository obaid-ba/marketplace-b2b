import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import * as catalogApi from '@/api/catalog'
import { createBuyerOrder } from '@/api/orders'
import * as api from '@/api/products'
import { useAuthStore } from '@/stores/auth'
import ProductPage from './ProductPage'

vi.mock('@/api/http', () => ({ http: { get: vi.fn() }, onAuthError: vi.fn() }))
vi.mock('@/api/favorites', () => ({ addFavoriteSupplier: vi.fn(), removeFavoriteSupplier: vi.fn() }))
vi.mock('@/api/catalog', () => ({ searchProducts: vi.fn() }))
vi.mock('@/api/orders', () => ({ createBuyerOrder: vi.fn() }))
vi.mock('@/api/products', () => ({ fetchProduct: vi.fn() }))

const product = (overrides = {}) => ({
  id: 3,
  title: 'Cartons ondulés sur mesure',
  type: 'product',
  description: 'Cartons simple ou double cannelure.',
  price: 2.4,
  unit: 'pièce',
  stock: 12500,
  in_stock: true,
  availability_days: 5,
  images: [
    { id: 1, url: '/1.jpg' },
    { id: 2, url: '/2.jpg' },
  ],
  category: { id: 11, name: 'Cartons et caisses', parent: { id: 1, name: 'Emballage et conditionnement' } },
  supplier: { id: 7, company_name: 'Atlas Emballages', logo_url: null, region: 'Sfax', rating_avg: 4.6, reviews_count: 38, is_favorite: false, delivery_days: 3, payment_terms: 'Virement' },
  same_supplier_products: [{ id: 43, title: 'Ruban adhésif', price: '4.50', unit: 'rouleau', stock: 20 }],
  latest_reviews: [{ id: 9, author: 'Sana B.', rating: 5, comment: 'Livraison rapide.', supplier_reply: null }],
  ...overrides,
})

let location
function Spy() {
  location = useLocation()
  return null
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/produits/3']}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <ProductPage />
              <Spy />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

function login(role) {
  useAuthStore.setState({ user: role ? { id: 1, role, email_verified: true } : null, token: role ? 't' : null, loaded: true })
}

beforeEach(() => {
  window.scrollTo = vi.fn()
  sessionStorage.clear()
  login(null)
  api.fetchProduct.mockResolvedValue(product())
  catalogApi.searchProducts.mockResolvedValue({
    data: [{ id: 4, title: 'Palettes bois EPAL', price: 18, unit: 'unité', supplier: { id: 8, company_name: 'Djerba Pack', region: 'Médenine', rating_avg: 4.3 } }],
    meta: { current_page: 1, last_page: 1, total: 1 },
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ProductPage', () => {
  it('affiche toutes les informations du produit', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Cartons ondulés sur mesure' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Emballage et conditionnement' }).getAttribute('href')).toBe('/catalogue?category=1')
    expect(screen.getByText('En stock')).toBeTruthy()
    expect(screen.getByText('2,40 TND')).toBeTruthy()
    expect(screen.getByText('/ pièce - prix hors taxes')).toBeTruthy()
    expect(screen.getByText(/4,6 sur 5 - 38 avis du fournisseur/)).toBeTruthy()
    expect(screen.getByText('5 jours')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Voir la fiche' }).getAttribute('href')).toBe('/fournisseurs/7')
    expect(screen.getByText('Livraison rapide.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Voir tous les avis' }).getAttribute('href')).toBe('/fournisseurs/7?tab=avis')
  })

  it('charge 4 produits similaires de la même catégorie, sans le produit lui-même', async () => {
    renderPage()

    expect(await screen.findByText('Palettes bois EPAL')).toBeTruthy()
    expect(catalogApi.searchProducts).toHaveBeenCalledWith({ category: 11, exclude: 3, per_page: 4 }, expect.anything())
  })

  it('change la photo principale en cliquant une vignette', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Cartons ondulés sur mesure' })

    fireEvent.click(screen.getByRole('button', { name: 'Afficher la photo 2' }))

    expect(screen.getByAltText('Cartons ondulés sur mesure').getAttribute('src')).toBe('/2.jpg')
  })

  it('un visiteur est invité à se connecter en cliquant sur Commander', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Commander' }))

    expect(location.pathname).toBe('/connexion')
    expect(new URLSearchParams(location.search).get('redirect')).toBe('/produits/3')
  })

  it('un porteur peut commander, contacter le fournisseur et l’ajouter à ses favoris', async () => {
    login('buyer')
    renderPage()

    expect((await screen.findByRole('button', { name: 'Commander' })).disabled).toBe(false)
    expect(screen.getByRole('button', { name: 'Contacter le fournisseur' }).disabled).toBe(false)
    expect(screen.getByRole('button', { name: 'Favori' })).toBeTruthy()
    expect(screen.getByText(/Délai moyen : 3 jours. Conditions : Virement./)).toBeTruthy()
  })

  it('commande plusieurs produits du même fournisseur après un récapitulatif', async () => {
    login('buyer')
    createBuyerOrder.mockResolvedValue({ order: { id: 101 } })
    renderPage()

    fireEvent.change(await screen.findByLabelText('Quantité (pièce)'), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /Ruban adhésif/ }))
    fireEvent.change(screen.getByLabelText('Quantité de Ruban adhésif'), { target: { value: '2' } })
    expect(screen.getByText('33 TND')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Commander' }))
    expect(screen.getByRole('dialog', { name: 'Récapitulatif de votre commande' })).toBeTruthy()
    expect(screen.getByText(/Aucun paiement en ligne — règlement selon les conditions du fournisseur/)).toBeTruthy()
    expect(createBuyerOrder).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Confirmer la commande' }))
    await waitFor(() => expect(location.pathname).toBe('/orders/101'))
    expect(createBuyerOrder).toHaveBeenCalledWith({
      items: [
        { product_id: 3, quantity: 10 },
        { product_id: 43, quantity: 2 },
      ],
    })
  })

  it('affiche le refus de l’API et permet de modifier la sélection', async () => {
    login('buyer')
    createBuyerOrder.mockRejectedValue(Object.assign(new Error(), { response: { data: { message: 'Stock insuffisant.' } } }))
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Commander' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer la commande' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Stock insuffisant.')
    fireEvent.click(screen.getByRole('button', { name: 'Modifier ma sélection' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('retrouve la sélection d’un visiteur après sa connexion, une seule fois', async () => {
    renderPage()
    fireEvent.change(await screen.findByLabelText('Quantité (pièce)'), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /Ruban adhésif/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Commander' }))
    expect(location.pathname).toBe('/connexion')
    cleanup()

    login('buyer')
    renderPage()
    expect(await screen.findByRole('dialog', { name: 'Récapitulatif de votre commande' })).toBeTruthy()
    expect(screen.getByLabelText('Quantité (pièce)').value).toBe('7')
    expect(screen.getByRole('checkbox', { name: /Ruban adhésif/ }).checked).toBe(true)
    cleanup()

    renderPage()
    expect((await screen.findByLabelText('Quantité (pièce)')).value).toBe('1')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('ne propose pas de commander un produit en rupture', async () => {
    login('buyer')
    api.fetchProduct.mockResolvedValue(product({ in_stock: false, stock: 0 }))
    renderPage()
    expect((await screen.findByRole('button', { name: 'Commander' })).disabled).toBe(true)
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('contrôle la quantité entre 1 et le stock', async () => {
    api.fetchProduct.mockResolvedValue(product({ stock: 10 }))
    renderPage()
    const input = await screen.findByLabelText('Quantité (pièce)')

    fireEvent.change(input, { target: { value: '11' } })
    expect(screen.getByText('Choisissez une quantité entre 1 et 10.')).toBeTruthy()
    fireEvent.change(input, { target: { value: '0' } })
    expect(screen.getByRole('alert')).toBeTruthy()
    fireEvent.change(input, { target: { value: '3' } })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('pas de boutons d’achat pour un fournisseur ou un administrateur', async () => {
    login('supplier')
    renderPage()

    await screen.findByRole('heading', { name: 'Cartons ondulés sur mesure' })
    expect(screen.queryByRole('button', { name: 'Commander' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Favori' })).toBeNull()
  })

  it('affiche « Rupture » et un état vide sans avis', async () => {
    api.fetchProduct.mockResolvedValue(product({ in_stock: false, stock: 0, latest_reviews: [] }))
    renderPage()

    expect(await screen.findByText('Rupture')).toBeTruthy()
    expect(screen.getByText('Ce fournisseur n’a pas encore reçu d’avis.')).toBeTruthy()
  })

  it('affiche « Produit introuvable » sur un 404', async () => {
    api.fetchProduct.mockRejectedValue(Object.assign(new Error('404'), { response: { status: 404 } }))
    renderPage()

    expect(await screen.findByText('Produit introuvable')).toBeTruthy()
  })

  it('un service n’affiche ni stock ni badge En stock', async () => {
    api.fetchProduct.mockResolvedValue(product({ type: 'service', stock: null, unit: 'jour' }))
    renderPage()

    await screen.findByText('Service')
    expect(screen.queryByText('Stock disponible')).toBeNull()
    expect(screen.queryByText('En stock')).toBeNull()
    await waitFor(() => expect(catalogApi.searchProducts).toHaveBeenCalled())
  })
})
