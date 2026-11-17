import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import * as catalogApi from '@/api/catalog'
import * as categoriesApi from '@/api/categories'
import CatalogView from './CatalogView'

vi.mock('@/api/http', () => ({ http: { get: vi.fn() }, onAuthError: vi.fn() }))
vi.mock('@/api/catalog', () => ({ searchProducts: vi.fn(), fetchRegions: vi.fn() }))
vi.mock('@/api/categories', () => ({ fetchCategories: vi.fn() }))

const card = (id, title) => ({
  id,
  title,
  type: 'product',
  price: 2.4,
  unit: 'pièce',
  main_image_url: null,
  supplier: { id: 1, company_name: 'Atlas Emballages', region: 'Sfax', rating_avg: 4.6 },
})

function page(products, meta = {}) {
  return { data: products, meta: { current_page: 1, last_page: 1, total: products.length, ...meta } }
}

let location
function LocationSpy() {
  location = useLocation()
  return null
}

function renderAt(url) {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route
          path="/catalogue"
          element={
            <>
              <CatalogView />
              <LocationSpy />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  window.scrollTo = vi.fn()
  categoriesApi.fetchCategories.mockResolvedValue([
    { id: 1, name: 'Emballage et conditionnement', children: [{ id: 11, name: 'Cartons' }] },
    { id: 2, name: 'Matières premières', children: [] },
  ])
  catalogApi.fetchRegions.mockResolvedValue([
    { id: 1, name: 'Sfax' },
    { id: 2, name: 'Médenine' },
    { id: 3, name: 'Tunis' },
    { id: 4, name: 'Sousse' },
    { id: 5, name: 'Gabès' },
  ])
  catalogApi.searchProducts.mockResolvedValue(page([card(1, 'Cartons ondulés sur mesure'), card(2, 'Palettes bois EPAL')], { total: 248, last_page: 21 }))
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('CatalogView', () => {
  it('affiche les résultats avec le nombre total et le prix formaté', async () => {
    renderAt('/catalogue')

    expect(await screen.findByText('Cartons ondulés sur mesure')).toBeTruthy()
    expect(screen.getByText('248 résultats')).toBeTruthy()
    expect(screen.getAllByText('2,40 TND / pièce')).toHaveLength(2)
    expect(screen.getAllByText('Atlas Emballages - Sfax')).toHaveLength(2)
  })

  it("transmet les filtres de l'URL à l'API", async () => {
    renderAt('/catalogue?q=carton&category=1&region=2&price_max=5000&delay=7&rating=4&sort=price_asc&page=2')

    await waitFor(() =>
      expect(catalogApi.searchProducts).toHaveBeenCalledWith(
        { q: 'carton', category: '1', region: '2', price_max: '5000', delay: '7', rating: '4', sort: 'price_asc', page: 2 },
        expect.anything(),
      ),
    )
  })

  it('cocher une catégorie met à jour l’URL et revient en page 1', async () => {
    renderAt('/catalogue?page=3')
    const filters = await screen.findByRole('complementary', { name: 'Filtres' })
    await within(filters).findByText('Matières premières')

    fireEvent.click(within(filters).getByLabelText('Matières premières'))

    await waitFor(() => expect(location.search).toBe('?category=2'))
  })

  it('la recherche est appliquée à la validation', async () => {
    renderAt('/catalogue')
    await screen.findByText('Cartons ondulés sur mesure')

    fireEvent.change(screen.getByLabelText('Rechercher un produit ou un service'), { target: { value: 'palette' } })
    expect(location.search).toBe('')
    fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }))

    await waitFor(() => expect(location.search).toBe('?q=palette'))
  })

  it('le tri est immédiat', async () => {
    renderAt('/catalogue')
    await screen.findByText('Cartons ondulés sur mesure')

    fireEvent.change(screen.getByLabelText('Trier par'), { target: { value: 'price_desc' } })

    await waitFor(() => expect(location.search).toBe('?sort=price_desc'))
  })

  it('les filtres Délai et Note sont disponibles', async () => {
    renderAt('/catalogue')
    const filters = await screen.findByRole('complementary', { name: 'Filtres' })

    fireEvent.click(within(filters).getByLabelText('Sous 48 h'))
    await waitFor(() => expect(location.search).toBe('?delay=2'))
    fireEvent.click(within(filters).getByLabelText('4 ★ et plus'))
    await waitFor(() => expect(location.search).toBe('?delay=2&rating=4'))
  })

  it('n’affiche que 4 régions puis « Voir plus »', async () => {
    renderAt('/catalogue')
    const filters = await screen.findByRole('complementary', { name: 'Filtres' })
    await within(filters).findByText('Gabès')

    expect(within(filters).queryByLabelText('Tunis')).toBeNull()
    fireEvent.click(within(filters).getByRole('button', { name: 'Voir plus (1)' }))
    expect(within(filters).getByLabelText('Tunis')).toBeTruthy()
  })

  it('affiche un état vide avec réinitialisation', async () => {
    catalogApi.searchProducts.mockResolvedValue(page([]))
    renderAt('/catalogue?q=zzz&rating=4')

    expect(await screen.findByText('Aucun produit ne correspond à votre recherche')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser la recherche' }))
    await waitFor(() => expect(location.search).toBe(''))
  })

  it('affiche une erreur avec Réessayer', async () => {
    catalogApi.searchProducts.mockRejectedValueOnce(Object.assign(new Error('x'), { userMessage: 'Serveur indisponible.' }))
    renderAt('/catalogue')

    expect(await screen.findByText('Serveur indisponible.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByText('Cartons ondulés sur mesure')).toBeTruthy()
  })

  it('change de page via la pagination', async () => {
    renderAt('/catalogue?category=1')
    await screen.findByText('Cartons ondulés sur mesure')

    fireEvent.click(screen.getByRole('button', { name: 'Page 2' }))
    await waitFor(() => expect(location.search).toBe('?category=1&page=2'))
  })
})
