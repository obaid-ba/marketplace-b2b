import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { useAuthStore } from '@/stores/auth'
import OfflineBanner from '@/components/OfflineBanner'
import ErrorBoundary from './ErrorBoundary'

vi.mock('@/api/http', () => ({ http: { get: vi.fn(), post: vi.fn() }, onAuthError: vi.fn() }))

function renderCrash(error) {
  useAuthStore.setState({ user: null, token: null, loaded: true })
  const router = createMemoryRouter(
    [
      {
        path: '/',
        loader: () => {
          throw error
        },
        Component: () => null,
        ErrorBoundary,
      },
    ],
    { initialEntries: ['/'] },
  )
  render(<RouterProvider router={router} />)
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Pages d’erreur (SCRUM-92)', () => {
  it('500 : message clair, Réessayer et retour à l’accueil', async () => {
    renderCrash(new Error('boom'))

    expect(await screen.findByRole('heading', { name: 'Une erreur est survenue' })).toBeTruthy()
    expect(screen.getByText('500')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy()
    expect(screen.getByRole('link', { name: "Retour à l'accueil" }).getAttribute('href')).toBe('/')
  })

  it('hors ligne : page dédiée quand une page ne peut pas être téléchargée', async () => {
    renderCrash(new TypeError('Failed to fetch dynamically imported module: /assets/Page.js'))

    expect(await screen.findByRole('heading', { name: 'Connexion interrompue' })).toBeTruthy()
  })

  it('bandeau hors ligne quand la connexion tombe', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    render(<OfflineBanner />)

    expect(screen.getByRole('status').textContent).toContain('Vous êtes hors ligne')
  })
})
