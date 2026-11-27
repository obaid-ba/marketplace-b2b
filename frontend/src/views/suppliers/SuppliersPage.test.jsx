import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { fetchRegions } from '@/api/catalog'
import { fetchCategories } from '@/api/categories'
import { searchSuppliers } from '@/api/suppliers'
import SuppliersPage from './SuppliersPage'

vi.mock('@/api/http', () => ({ http: { get: vi.fn() }, onAuthError: vi.fn() }))
vi.mock('@/api/catalog', () => ({ fetchRegions: vi.fn() }))
vi.mock('@/api/categories', () => ({ fetchCategories: vi.fn() }))
vi.mock('@/api/suppliers', () => ({ searchSuppliers: vi.fn() }))

const RESULT = {
  data: [
    {
      id: 7,
      company_name: 'Atlas Emballages',
      logo_url: null,
      sector: 'Emballage',
      description: 'Cartons ondulés sur mesure.',
      region: 'Sfax',
      categories: ['Cartonnage'],
      rating_avg: 4.6,
      reviews_count: 3,
      products_count: 4,
    },
  ],
  meta: { current_page: 1, last_page: 1, total: 1 },
}

let location
function Spy() {
  location = useLocation()
  return null
}

function renderAt(url = '/fournisseurs') {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route
          path="/fournisseurs"
          element={
            <>
              <SuppliersPage />
              <Spy />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  searchSuppliers.mockResolvedValue(RESULT)
  fetchRegions.mockResolvedValue([{ id: 12, name: 'Sfax' }])
  fetchCategories.mockResolvedValue([{ id: 1, name: 'Emballage', children: [{ id: 2, name: 'Cartonnage' }] }])
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('SuppliersPage', () => {
  it('affiche les fournisseurs avec note, produits et lien vers leur fiche', async () => {
    renderAt()

    expect(await screen.findByText('Atlas Emballages')).toBeTruthy()
    expect(screen.getByText('1 fournisseur')).toBeTruthy()
    expect(screen.getByText('4 produits')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Atlas Emballages/ }).getAttribute('href')).toBe('/fournisseurs/7')
  })

  it('garde la recherche et les filtres dans l’adresse', async () => {
    renderAt()
    await screen.findByRole('option', { name: 'Sfax' })

    fireEvent.change(screen.getByLabelText('Rechercher un fournisseur'), { target: { value: 'carton' } })
    fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }))
    fireEvent.change(screen.getByLabelText('Région'), { target: { value: '12' } })

    await waitFor(() => expect(location.search).toBe('?q=carton&region_id=12'))
    await waitFor(() => expect(searchSuppliers).toHaveBeenLastCalledWith({ q: 'carton', region_id: '12' }))
  })

  it('indique quand aucun fournisseur ne correspond', async () => {
    searchSuppliers.mockResolvedValue({ data: [], meta: { current_page: 1, last_page: 1, total: 0 } })
    renderAt('/fournisseurs?q=introuvable')

    expect(await screen.findByText('Aucun fournisseur ne correspond')).toBeTruthy()
  })
})
