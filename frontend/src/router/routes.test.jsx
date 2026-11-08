import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { useAuthStore } from '@/stores/auth'
import { createRoutes } from './routes'

vi.mock('@/api/http', () => ({ http: { get: vi.fn(), post: vi.fn() }, onAuthError: vi.fn() }))

function visit(path) {
  const router = createMemoryRouter(createRoutes(), { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

function signIn(user) {
  useAuthStore.setState({ user, token: 'test-token', loaded: true })
}

beforeEach(() => {
  useAuthStore.setState({ user: null, token: null, loaded: true })
})

afterEach(cleanup)

describe('routes', () => {
  it("affiche la page d'accueil aux visiteurs", async () => {
    visit('/')
    expect(await screen.findByText('Se connecter')).toBeTruthy()
  })

  it('redirige un visiteur vers la connexion depuis un espace protégé', async () => {
    const router = visit('/fournisseur')
    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/connexion')
    expect(router.state.location.search).toBe('?redirect=%2Ffournisseur')
  })

  it('affiche le tableau de bord du bon rôle', async () => {
    signIn({ name: 'Amel', role: 'supplier' })
    visit('/fournisseur')
    expect(await screen.findByText('Tableau de bord fournisseur')).toBeTruthy()
    expect(screen.getByText('Bonjour Amel')).toBeTruthy()
  })

  it("refuse l'espace d'un autre rôle", async () => {
    signIn({ name: 'Karim', role: 'buyer' })
    visit('/admin')
    expect(await screen.findByText('Accès refusé')).toBeTruthy()
  })

  it('affiche la page 404 pour une adresse inconnue', async () => {
    visit('/nimporte-quoi')
    expect(await screen.findByText('Page introuvable')).toBeTruthy()
  })
})
