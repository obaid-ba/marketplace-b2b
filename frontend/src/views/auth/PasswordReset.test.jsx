import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { http } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { createRoutes } from '@/router/routes'

vi.mock('@/api/http', () => ({ http: { get: vi.fn(), post: vi.fn() }, onAuthError: vi.fn() }))

function apiError(status, data) {
  return Object.assign(new Error(data.message), {
    response: { status, data },
    userMessage: data.message,
    fieldErrors: data.errors ?? {},
  })
}

function visit(path) {
  const router = createMemoryRouter(createRoutes(), { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

const RESET_LINK = '/mot-de-passe/nouveau?token=abc123&email=karim%40test.tn'
const SAME_MESSAGE =
  'Si un compte existe pour cette adresse, vous allez recevoir un e-mail avec un lien pour choisir un nouveau mot de passe.'

async function typePasswords(password, confirmation = password) {
  fireEvent.change(await screen.findByLabelText('Nouveau mot de passe'), { target: { value: password } })
  fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), { target: { value: confirmation } })
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le mot de passe' }))
}

beforeEach(() => {
  useAuthStore.setState({ user: null, token: null, loaded: true })
  vi.mocked(http.post).mockReset()
})

afterEach(cleanup)

describe('Mot de passe oublié (SCRUM-26)', () => {
  it('le lien de la page de connexion ouvre le formulaire', async () => {
    visit('/connexion')
    fireEvent.click(await screen.findByRole('link', { name: 'Mot de passe oublié ?' }))
    expect(await screen.findByRole('heading', { name: 'Mot de passe oublié' })).toBeTruthy()
  })

  it("affiche le message de l'API, identique que le compte existe ou non", async () => {
    vi.mocked(http.post).mockResolvedValue({ data: { message: SAME_MESSAGE } })
    visit('/mot-de-passe-oublie')

    fireEvent.change(await screen.findByLabelText('Adresse e-mail'), { target: { value: 'karim@test.tn ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Recevoir le lien' }))

    expect(await screen.findByText(SAME_MESSAGE)).toBeTruthy()
    expect(http.post).toHaveBeenCalledWith('/auth/forgot-password', { email: 'karim@test.tn' })
  })

  it('vérifie la confirmation et la robustesse avant d’appeler l’API', async () => {
    visit(RESET_LINK)

    await typePasswords('Nouveau2026', 'Autre2026')
    expect(await screen.findByText('Les deux mots de passe ne correspondent pas.')).toBeTruthy()

    await typePasswords('faible')
    expect(screen.getByText(/8 caractères minimum/).className).toContain('text-red-600')

    expect(http.post).not.toHaveBeenCalled()
  })

  it('enregistre le mot de passe puis revient à la connexion avec un message de succès', async () => {
    const success = 'Votre mot de passe a été modifié. Vous pouvez maintenant vous connecter.'
    vi.mocked(http.post).mockResolvedValue({ data: { message: success } })
    const router = visit(RESET_LINK)

    await typePasswords('Nouveau2026')

    expect(await screen.findByText(success)).toBeTruthy()
    expect(router.state.location.pathname).toBe('/connexion')
    expect(screen.getByLabelText('Adresse e-mail').value).toBe('karim@test.tn')
    expect(http.post).toHaveBeenCalledWith(
      '/auth/reset-password',
      { token: 'abc123', email: 'karim@test.tn', password: 'Nouveau2026', password_confirmation: 'Nouveau2026' },
      { skipAuthRedirect: true },
    )
  })

  it('propose une nouvelle demande si le lien a expiré ou a déjà servi', async () => {
    vi.mocked(http.post).mockRejectedValue(
      apiError(422, {
        message: "Ce lien de réinitialisation n'est pas valide ou a expiré. Faites une nouvelle demande.",
        reason: 'invalid_token',
      }),
    )
    visit(RESET_LINK)
    await typePasswords('Nouveau2026')

    expect(await screen.findByRole('heading', { name: 'Lien invalide ou expiré' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Faire une nouvelle demande' }).getAttribute('href')).toBe(
      '/mot-de-passe-oublie',
    )
  })

  it('refuse un lien incomplet', async () => {
    visit('/mot-de-passe/nouveau?token=abc123')
    expect(await screen.findByRole('heading', { name: 'Lien invalide ou expiré' })).toBeTruthy()
  })
})
