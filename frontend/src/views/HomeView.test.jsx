import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import * as catalogApi from '@/api/catalog'
import * as homeApi from '@/api/home'
import { useAuthStore } from '@/stores/auth'
import HomeView from './HomeView'

vi.mock('@/api/http', () => ({ http: { get: vi.fn() }, onAuthError: vi.fn() }))
vi.mock('@/api/catalog', () => ({ fetchRegions: vi.fn(), searchProducts: vi.fn() }))
vi.mock('@/api/home', () => ({ fetchHome: vi.fn() }))

const home = {
  stats: { suppliers: 1200, products: 4500, regions: 24 },
  categories: [
    { id: 1, name: 'Emballage et conditionnement', products_count: 312 },
    { id: 2, name: 'Matières premières', products_count: 1 },
  ],
  featured_products: [
    { id: 5, title: 'Cartons ondulés sur mesure', price: 2.4, unit: 'pièce', supplier: { id: 7, company_name: 'Atlas Emballages', region: 'Sfax', rating_avg: 4.6 } },
  ],
}

let location
function Spy() {
  location = useLocation()
  return null
}

function renderHome() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <HomeView />
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
  homeApi.fetchHome.mockResolvedValue(home)
  catalogApi.fetchRegions.mockResolvedValue([{ id: 12, name: 'Médenine' }])
  catalogApi.searchProducts.mockResolvedValue({
    data: [{ id: 9, title: 'Palettes en bois', price: 18, unit: 'pièce', main_image_url: '/storage/palettes.jpg', supplier: { id: 3, company_name: 'Bois du Sud' } }],
    meta: { total: 1 },
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('HomeView', () => {
  it('affiche les chiffres, les catégories et les produits mis en avant', async () => {
    renderHome()

    expect(await screen.findByText('Cartons ondulés sur mesure')).toBeTruthy()
    expect(screen.getByText(/^1\s200$/)).toBeTruthy()
    expect(screen.getByText(/^4\s500$/)).toBeTruthy()
    expect(screen.getByText('24')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Emballage et conditionnement/ }).getAttribute('href')).toBe('/catalogue?category=1')
    expect(screen.getByText('312 produits')).toBeTruthy()
    expect(screen.getByText('1 produit')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Comment ça marche' })).toBeTruthy()
  })

  it('affiche le catalogue des produits avec leurs photos', async () => {
    renderHome()

    expect(await screen.findByText('Palettes en bois')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Catalogue des produits' })).toBeTruthy()
    expect(catalogApi.searchProducts).toHaveBeenCalledWith({ per_page: 8, category: undefined }, expect.anything())
  })

  it('la recherche ouvre le catalogue filtré par mots-clés et région', async () => {
    renderHome()
    await screen.findByRole('option', { name: 'Médenine' })

    fireEvent.change(screen.getByLabelText('Que cherchez-vous ?'), { target: { value: 'carton' } })
    fireEvent.change(screen.getByLabelText('Région'), { target: { value: '12' } })
    fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }))

    await waitFor(() => expect(location.pathname + location.search).toBe('/catalogue?q=carton&region=12'))
  })

  it('propose de s’inscrire et de se connecter aux visiteurs', async () => {
    renderHome()

    expect(screen.getByRole('link', { name: "S'inscrire" }).getAttribute('href')).toBe('/inscription')
    expect(screen.getByRole('link', { name: 'Se connecter' }).getAttribute('href')).toBe('/connexion')
    expect(screen.getByRole('link', { name: 'Publier une demande' }).getAttribute('href')).toBe('/inscription')
    await screen.findByText('Cartons ondulés sur mesure')
  })

  it('un utilisateur connecté ne voit plus les liens d’inscription', async () => {
    useAuthStore.setState({ user: { id: 1, role: 'buyer', email_verified: true }, token: 't', loaded: true })
    renderHome()

    expect(screen.queryByRole('link', { name: "S'inscrire" })).toBeNull()
    expect(screen.getByRole('link', { name: 'Publier une demande' }).getAttribute('href')).toBe('/porteur/demandes/nouvelle')
    await screen.findByText('Cartons ondulés sur mesure')
  })

  it('reste lisible si l’API ne répond pas', async () => {
    homeApi.fetchHome.mockRejectedValue(new Error('réseau'))
    renderHome()

    expect(await screen.findByText(/Les catégories n’ont pas pu être chargées/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: /Trouvez les bons fournisseurs/ })).toBeTruthy()
  })
})
