import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import * as api from '@/api/supplierProducts'
import MyProductsPage from './MyProductsPage'

vi.mock('@/api/http', () => ({ http: { get: vi.fn() }, onAuthError: vi.fn() }))
vi.mock('@/api/categories', () => ({
  fetchCategories: vi.fn().mockResolvedValue([{ id: 1, name: 'Emballage', children: [] }]),
}))
vi.mock('@/api/supplierProducts', () => ({
  fetchSupplierProducts: vi.fn(),
  unpublishSupplierProduct: vi.fn(),
  deleteSupplierProduct: vi.fn(),
}))

const row = (overrides) => ({
  id: 1,
  type: 'product',
  title: 'Cartons ondulés sur mesure',
  price: 2.4,
  unit: 'pièce',
  stock: 12500,
  status: 'published',
  views_count: 1240,
  withdrawal_reason: null,
  category: { id: 1, name: 'Emballage' },
  ...overrides,
})

const response = {
  data: [
    row(),
    row({ id: 2, title: 'Service de palettisation', type: 'service', stock: null, unit: 'jour', price: 350, views_count: 120 }),
    row({ id: 3, title: 'Étiqueteuse X2', status: 'withdrawn', unit: null, price: 9800, withdrawal_reason: 'Photos trompeuses' }),
  ],
  meta: { current_page: 1, last_page: 3, total: 24, from: 1, to: 3 },
  counts: { all: 24, published: 18, draft: 4, withdrawn: 2 },
}

let location
function Spy() {
  location = useLocation()
  return null
}

function renderAt(url = '/fournisseur/produits') {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route
          path="/fournisseur/produits"
          element={
            <>
              <MyProductsPage />
              <Spy />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  api.fetchSupplierProducts.mockResolvedValue(response)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('MyProductsPage', () => {
  it('affiche les onglets avec compteurs et le tableau', async () => {
    renderAt()
    const table = await screen.findByRole('table')

    expect(screen.getByRole('tab', { name: 'Tous (24)' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tab', { name: 'Publiés (18)' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Brouillons (4)' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Retirés (2)' })).toBeTruthy()
    expect(within(table).getByText('2,40 TND / pièce')).toBeTruthy()
    expect(within(table).getAllByText(/^1\s240$/)).toHaveLength(2)
    expect(within(table).getByText('—')).toBeTruthy() // stock d'un service
    expect(within(table).getByText(/^9\s800 TND$/)).toBeTruthy()
    expect(screen.getByText('Affichage 1 à 3 sur 24 produits')).toBeTruthy()
  })

  it('change d’onglet via l’URL', async () => {
    renderAt('/fournisseur/produits?page=2')
    await screen.findByRole('table')

    fireEvent.click(screen.getByRole('tab', { name: 'Brouillons (4)' }))

    await waitFor(() => expect(location.search).toBe('?status=draft'))
    await waitFor(() => expect(api.fetchSupplierProducts).toHaveBeenLastCalledWith({ status: 'draft' }))
  })

  it('affiche le motif d’un produit retiré', async () => {
    renderAt()
    const table = await screen.findByRole('table')

    fireEvent.click(within(table).getByRole('button', { name: 'Voir le motif' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Photos trompeuses')).toBeTruthy()
  })

  it('dépublie un produit depuis le menu « … »', async () => {
    api.unpublishSupplierProduct.mockResolvedValue({ message: 'Produit dépublié.' })
    renderAt()
    const table = await screen.findByRole('table')

    fireEvent.click(within(table).getByRole('button', { name: 'Autres actions pour « Cartons ondulés sur mesure »' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Dépublier' }))

    await waitFor(() => expect(api.unpublishSupplierProduct).toHaveBeenCalledWith(1))
    expect(await screen.findByText('Produit dépublié.')).toBeTruthy()
  })

  it('supprime après confirmation', async () => {
    api.deleteSupplierProduct.mockResolvedValue({ message: '« Cartons » a été supprimé.', permanent: true })
    renderAt()
    const table = await screen.findByRole('table')

    fireEvent.click(within(table).getByRole('button', { name: 'Autres actions pour « Cartons ondulés sur mesure »' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Supprimer' }))
    expect(api.deleteSupplierProduct).not.toHaveBeenCalled()
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Supprimer' }))

    await waitFor(() => expect(api.deleteSupplierProduct).toHaveBeenCalledWith(1))
    expect(await screen.findByText('« Cartons » a été supprimé.')).toBeTruthy()
  })

  it('le bouton Importer est désactivé', async () => {
    renderAt()
    expect(screen.getByRole('button', { name: 'Importer' }).disabled).toBe(true)
  })
})
