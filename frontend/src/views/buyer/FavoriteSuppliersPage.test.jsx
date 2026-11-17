import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import * as api from '@/api/favorites'
import FavoriteButton from '@/components/FavoriteButton'
import { useAuthStore } from '@/stores/auth'
import FavoriteSuppliersPage, { UNDO_DELAY_MS } from './FavoriteSuppliersPage'

vi.mock('@/api/http', () => ({ http: { get: vi.fn() }, onAuthError: vi.fn() }))
vi.mock('@/api/favorites', () => ({
  fetchFavoriteSuppliers: vi.fn(),
  addFavoriteSupplier: vi.fn(),
  removeFavoriteSupplier: vi.fn(),
}))

const atlas = { id: 1, company_name: 'Atlas Emballages', logo_url: null, region: 'Sfax', rating_avg: 4.6, categories: ['Emballage', 'Logistique'] }
const djerba = { id: 2, company_name: 'Djerba Pack', logo_url: null, region: 'Médenine', rating_avg: 4.3, categories: ['Emballage'] }

let location
function Spy() {
  location = useLocation()
  return null
}

function renderWithRouter(element, url = '/porteur/favoris') {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              {element}
              <Spy />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

function login(role) {
  useAuthStore.setState({ user: role ? { id: 9, role, email_verified: true } : null, token: role ? 't' : null, loaded: true })
}

beforeEach(() => {
  login('buyer')
  api.fetchFavoriteSuppliers.mockResolvedValue([atlas, djerba])
  api.removeFavoriteSupplier.mockResolvedValue({ is_favorite: false })
  api.addFavoriteSupplier.mockResolvedValue({ is_favorite: true })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('FavoriteSuppliersPage', () => {
  it('affiche les cartes des fournisseurs favoris', async () => {
    renderWithRouter(<FavoriteSuppliersPage />)

    const link = await screen.findByRole('link', { name: 'Atlas Emballages' })
    expect(link.getAttribute('href')).toBe('/fournisseurs/1')
    expect(screen.getByText('Sfax - ★ 4,6')).toBeTruthy()
    expect(screen.getAllByText('Emballage')).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'Inviter à une demande' })[0].disabled).toBe(true)
    expect(screen.getAllByRole('button', { name: 'Contacter' })[0].disabled).toBe(true)
  })

  it('retire un favori et permet d’annuler', async () => {
    renderWithRouter(<FavoriteSuppliersPage />)
    await screen.findByText('Atlas Emballages')

    fireEvent.click(screen.getByRole('button', { name: 'Retirer « Atlas Emballages » des favoris' }))

    expect(screen.queryByText('Atlas Emballages')).toBeNull()
    await waitFor(() => expect(api.removeFavoriteSupplier).toHaveBeenCalledWith(1))
    fireEvent.click(await screen.findByRole('button', { name: 'Annuler' }))

    expect(screen.getByRole('link', { name: 'Atlas Emballages' })).toBeTruthy()
    await waitFor(() => expect(api.addFavoriteSupplier).toHaveBeenCalledWith(1))
  })

  it('le bouton Annuler disparaît après 5 secondes', async () => {
    renderWithRouter(<FavoriteSuppliersPage />)
    await screen.findByText('Atlas Emballages')
    vi.useFakeTimers()

    fireEvent.click(screen.getByRole('button', { name: 'Retirer « Atlas Emballages » des favoris' }))
    await act(async () => {})
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeTruthy()

    act(() => vi.advanceTimersByTime(UNDO_DELAY_MS))
    expect(screen.queryByRole('button', { name: 'Annuler' })).toBeNull()
  })

  it('remet le favori si le retrait échoue', async () => {
    api.removeFavoriteSupplier.mockRejectedValue(Object.assign(new Error('x'), { userMessage: 'Serveur indisponible.' }))
    renderWithRouter(<FavoriteSuppliersPage />)
    await screen.findByText('Atlas Emballages')

    fireEvent.click(screen.getByRole('button', { name: 'Retirer « Atlas Emballages » des favoris' }))

    expect(await screen.findByText('Serveur indisponible.')).toBeTruthy()
    expect(screen.getByText('Atlas Emballages')).toBeTruthy()
  })

  it('affiche un état vide avec un lien vers le catalogue', async () => {
    api.fetchFavoriteSuppliers.mockResolvedValue([])
    renderWithRouter(<FavoriteSuppliersPage />)

    expect(await screen.findByText("Vous n'avez pas encore de fournisseur favori")).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Parcourir le catalogue' }).getAttribute('href')).toBe('/catalogue')
  })
})

describe('FavoriteButton', () => {
  it('un invité est envoyé vers la connexion puis revient sur la page', () => {
    login(null)
    renderWithRouter(<FavoriteButton supplierId={1} />, '/fournisseurs/1?tab=avis')

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter aux favoris' }))

    expect(location.pathname).toBe('/connexion')
    expect(new URLSearchParams(location.search).get('redirect')).toBe('/fournisseurs/1?tab=avis')
  })

  it('est masqué pour un fournisseur ou un administrateur', () => {
    login('supplier')
    renderWithRouter(<FavoriteButton supplierId={1} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('met à jour immédiatement puis annule si l’API échoue', async () => {
    api.addFavoriteSupplier.mockRejectedValue(Object.assign(new Error('x'), { userMessage: 'Erreur réseau.' }))
    renderWithRouter(<FavoriteButton supplierId={1} />)

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter aux favoris' }))
    expect(screen.getByRole('button', { name: 'Retirer des favoris' }).getAttribute('aria-pressed')).toBe('true')

    expect(await screen.findByText('Erreur réseau.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Ajouter aux favoris' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('retire un favori existant', async () => {
    renderWithRouter(<FavoriteButton supplierId={1} initialIsFavorite variant="icon" />)

    fireEvent.click(screen.getByRole('button', { name: 'Retirer des favoris' }))

    await waitFor(() => expect(api.removeFavoriteSupplier).toHaveBeenCalledWith(1))
  })
})
