import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import * as catalogApi from '@/api/catalog'
import * as api from '@/api/suppliers'
import { useAuthStore } from '@/stores/auth'
import SupplierPublicPage from './SupplierPublicPage'

vi.mock('@/api/http', () => ({ http: { get: vi.fn() }, onAuthError: vi.fn() }))
vi.mock('@/api/favorites', () => ({ addFavoriteSupplier: vi.fn(), removeFavoriteSupplier: vi.fn() }))
vi.mock('@/api/catalog', () => ({ searchProducts: vi.fn() }))
vi.mock('@/api/suppliers', () => ({ fetchSupplier: vi.fn(), fetchSupplierReviews: vi.fn() }))

const supplier = {
  id: 7,
  company_name: 'Atlas Emballages',
  logo_url: null,
  description: 'Spécialiste des emballages en carton ondulé depuis 2009.',
  sector: 'Emballage et conditionnement',
  region: 'Sfax',
  categories: [{ id: 1, name: 'Emballage' }, { id: 2, name: 'Logistique' }],
  coverage_regions: ['Sfax', 'Médenine'],
  rating_avg: 4.6,
  reviews_count: 38,
  products_count: 24,
  is_favorite: false,
  ai_summary: null,
}

const reviews = {
  data: [
    { id: 1, author: 'Sana B.', rating: 5, comment: 'Livraison rapide.', supplier_reply: 'Merci Sana !', created_at: '2026-11-10T10:00:00Z' },
    { id: 2, author: 'Karim T.', rating: 4, comment: 'Bon rapport qualité-prix.', supplier_reply: null, created_at: '2026-11-01T10:00:00Z' },
  ],
  meta: { current_page: 1, last_page: 1, total: 2 },
}

let location
function Spy() {
  location = useLocation()
  return null
}

function renderAt(url = '/fournisseurs/7') {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route
          path="/fournisseurs/:supplierId"
          element={
            <>
              <SupplierPublicPage />
              <Spy />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useAuthStore.setState({ user: null, token: null, loaded: true })
  api.fetchSupplier.mockResolvedValue(supplier)
  api.fetchSupplierReviews.mockResolvedValue(reviews)
  catalogApi.searchProducts.mockResolvedValue({
    data: [{ id: 3, title: 'Cartons ondulés sur mesure', price: 2.4, unit: 'pièce', supplier: { id: 7, company_name: 'Atlas Emballages', region: 'Sfax', rating_avg: 4.6 } }],
    meta: { current_page: 1, last_page: 1, total: 1 },
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('SupplierPublicPage', () => {
  it("affiche l'en-tête, la présentation et les produits du fournisseur", async () => {
    renderAt()

    expect(await screen.findByRole('heading', { name: 'Atlas Emballages' })).toBeTruthy()
    expect(screen.getByText('Fournisseur validé')).toBeTruthy()
    expect(screen.getByText('Sfax - Emballage et conditionnement')).toBeTruthy()
    expect(screen.getByText('★ 4,6 (38 avis)')).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Produits (24)' }).getAttribute('aria-selected')).toBe('true')
    expect(await screen.findByText('Cartons ondulés sur mesure')).toBeTruthy()
    expect(catalogApi.searchProducts).toHaveBeenCalledWith({ supplier_id: 7, page: 1, per_page: 12 }, expect.anything())
    expect(screen.getByText('Spécialiste des emballages en carton ondulé depuis 2009.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Contacter' }).disabled).toBe(false)
    expect(screen.getByRole('button', { name: 'Ajouter aux favoris' })).toBeTruthy()
  })

  it("l'onglet Avis est dans l'URL et affiche les réponses du fournisseur", async () => {
    renderAt()
    fireEvent.click(await screen.findByRole('tab', { name: 'Avis (38)' }))

    await waitFor(() => expect(location.search).toBe('?tab=avis'))
    expect(await screen.findByText('Livraison rapide.')).toBeTruthy()
    expect(screen.getByText('Réponse de Atlas Emballages')).toBeTruthy()
    expect(screen.getByText('Merci Sana !')).toBeTruthy()
    expect(screen.queryByText('Ce que les clients en disent')).toBeNull()
  })

  it("affiche le résumé IA seulement s'il existe (SCRUM-83)", async () => {
    api.fetchSupplier.mockResolvedValue({
      ...supplier,
      ai_summary: {
        summary: '3 avis analysés : 2 positifs, 0 mitigé, 1 négatif.',
        strengths: ['Livraison rapide'],
        weaknesses: ['Prix jugés élevés'],
        reviews_count: 3,
        simulated: false,
      },
    })
    renderAt('/fournisseurs/7?tab=avis')

    expect(await screen.findByText('Ce que les clients en disent')).toBeTruthy()
    expect(screen.getByText('Résumé généré par IA')).toBeTruthy()
    expect(screen.getByText('+ Livraison rapide')).toBeTruthy()
    expect(screen.getByText('– Prix jugés élevés')).toBeTruthy()
  })

  it('affiche un état vide sans avis', async () => {
    api.fetchSupplierReviews.mockResolvedValue({ data: [], meta: { current_page: 1, last_page: 1, total: 0 } })
    renderAt('/fournisseurs/7?tab=avis')

    expect(await screen.findByText('Ce fournisseur n’a pas encore reçu d’avis.')).toBeTruthy()
  })

  it('affiche « Fournisseur introuvable » sur un 404', async () => {
    api.fetchSupplier.mockRejectedValue(Object.assign(new Error('404'), { response: { status: 404 } }))
    renderAt()

    expect(await screen.findByText('Fournisseur introuvable')).toBeTruthy()
  })

  it('le bouton favori est masqué pour un fournisseur connecté', async () => {
    useAuthStore.setState({ user: { id: 1, role: 'supplier', email_verified: true }, token: 't', loaded: true })
    renderAt()

    await screen.findByRole('heading', { name: 'Atlas Emballages' })
    expect(screen.queryByRole('button', { name: 'Ajouter aux favoris' })).toBeNull()
  })
})
