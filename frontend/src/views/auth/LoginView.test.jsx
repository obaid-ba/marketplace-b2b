import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { http } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { createRoutes } from '@/router/routes'

vi.mock('@/api/http', () => ({ http: { get: vi.fn(), post: vi.fn() }, onAuthError: vi.fn() }))

/** Erreur telle que la produit l'intercepteur Axios (voir api/http.js). */
function apiError(status, data) {
  return Object.assign(new Error(data.message), {
    response: { status, data },
    userMessage: data.message,
    fieldErrors: data.errors ?? {},
  })
}

function visitLogin(path = '/connexion') {
  const router = createMemoryRouter(createRoutes(), { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

async function fillAndSubmit({ remember = false } = {}) {
  fireEvent.change(await screen.findByLabelText('Adresse e-mail'), { target: { value: ' karim@test.tn ' } })
  fireEvent.change(screen.getByLabelText('Mot de passe'), { target: { value: 'Secret123' } })
  if (remember) fireEvent.click(screen.getByLabelText('Se souvenir de moi'))
  fireEvent.click(screen.getByRole('button', { name: 'Se connecter' }))
}

const buyer = { id: 1, name: 'Karim', role: 'buyer', email_verified: true }

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  useAuthStore.setState({ user: null, token: null, loaded: true })
  vi.mocked(http.post).mockReset()
})

afterEach(cleanup)

describe('Connexion (SCRUM-25)', () => {
  it('propose « Se souvenir de moi » et « Mot de passe oublié »', async () => {
    visitLogin()
    expect(await screen.findByLabelText('Se souvenir de moi')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Mot de passe oublié ?' }).getAttribute('href')).toBe('/mot-de-passe-oublie')
  })

  it('redirige vers le tableau de bord du rôle', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: { token: 't1', user: buyer } })
    const router = visitLogin()
    await fillAndSubmit()

    expect(await screen.findByText('Tableau de bord porteur de projet')).toBeTruthy()
    expect(router.state.location.pathname).toBe('/porteur')
    expect(http.post).toHaveBeenCalledWith('/auth/login', {
      email: 'karim@test.tn',
      password: 'Secret123',
      remember: false,
      device_name: 'web',
    })
  })

  it('sans « Se souvenir de moi », le jeton disparaît à la fermeture du navigateur', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: { token: 't1', user: buyer } })
    visitLogin()
    await fillAndSubmit()
    await screen.findByText('Tableau de bord porteur de projet')

    expect(sessionStorage.getItem('mb2b_token')).toBe('t1')
    expect(localStorage.getItem('mb2b_token')).toBeNull()
  })

  it('avec « Se souvenir de moi », le jeton est conservé', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: { token: 't2', user: buyer } })
    visitLogin()
    await fillAndSubmit({ remember: true })
    await screen.findByText('Tableau de bord porteur de projet')

    expect(http.post).toHaveBeenCalledWith('/auth/login', expect.objectContaining({ remember: true }))
    expect(localStorage.getItem('mb2b_token')).toBe('t2')
    expect(sessionStorage.getItem('mb2b_token')).toBeNull()
  })

  it('affiche un message général pour des identifiants incorrects', async () => {
    vi.mocked(http.post).mockRejectedValue(
      apiError(422, {
        message: 'Adresse e-mail ou mot de passe incorrect.',
        errors: { email: ['Adresse e-mail ou mot de passe incorrect.'] },
      }),
    )
    visitLogin()
    await fillAndSubmit()

    expect((await screen.findByRole('alert')).textContent).toBe('Adresse e-mail ou mot de passe incorrect.')
  })

  it('affiche un message explicite pour un compte suspendu', async () => {
    const message = "Votre compte a été suspendu. Contactez l'administrateur de la plateforme pour en savoir plus."
    vi.mocked(http.post).mockRejectedValue(apiError(403, { message, reason: 'suspended' }))
    visitLogin()
    await fillAndSubmit()

    expect((await screen.findByRole('alert')).textContent).toBe(message)
    expect(useAuthStore.getState().token).toBeNull()
  })

  it('affiche le message de limitation des tentatives', async () => {
    vi.mocked(http.post).mockRejectedValue(apiError(429, { message: 'Trop de tentatives. Réessayez dans une minute.' }))
    visitLogin()
    await fillAndSubmit()

    expect((await screen.findByRole('alert')).textContent).toBe('Trop de tentatives. Réessayez dans une minute.')
  })
})
