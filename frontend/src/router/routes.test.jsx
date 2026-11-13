import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { http } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { createRoutes } from './routes'

vi.mock('@/api/http', () => ({ http: { get: vi.fn(), post: vi.fn() }, onAuthError: vi.fn() }))

function visit(path) {
  const router = createMemoryRouter(createRoutes(), { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

function signIn(user) {
  useAuthStore.setState({ user: { id: 1, email_verified: true, ...user }, token: 'test-token', loaded: true })
}

/** Réponse d'erreur telle que la produit l'intercepteur Axios (voir api/http.js). */
function apiError(status, data) {
  return Object.assign(new Error(data.message), { response: { status, data }, userMessage: data.message })
}

const VERIFY_LINK = '/email/verifier?id=1&hash=abc&expires=1999999999&signature=sig'

beforeEach(() => {
  useAuthStore.setState({ user: null, token: null, loaded: true })
  vi.mocked(http.get).mockReset()
})

afterEach(cleanup)

describe('routes', () => {
  it("affiche la page d'accueil aux visiteurs", async () => {
    visit('/')
    expect(await screen.findByText('Se connecter')).toBeTruthy()
  })

  it("affiche la page d'inscription fournisseur aux visiteurs", async () => {
    visit('/inscription/fournisseur')
    expect(await screen.findByRole('heading', { name: 'Inscription fournisseur' })).toBeTruthy()
  })

  it('laisse choisir le type de compte avant de s inscrire', async () => {
    visit('/inscription')
    expect(await screen.findByRole('heading', { name: 'Créer un compte' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Je suis fournisseur/ }).getAttribute('href')).toBe(
      '/inscription/fournisseur',
    )
    expect(screen.getByRole('link', { name: /Je suis porteur de projet/ }).getAttribute('href')).toBe(
      '/inscription/porteur',
    )
  })

  it("affiche le formulaire d'inscription porteur de projet", async () => {
    visit('/inscription/porteur')
    expect(await screen.findByRole('heading', { name: 'Inscription porteur de projet' })).toBeTruthy()
  })

  it('redirige un visiteur vers la connexion depuis un espace protégé', async () => {
    const router = visit('/fournisseur')
    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/connexion')
    expect(router.state.location.search).toBe('?redirect=%2Ffournisseur')
  })

  it('affiche le tableau de bord du bon rôle', async () => {
    signIn({ name: 'Amel', role: 'supplier', supplier_validation_status: 'validé' })
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

  it('ouvre les paramètres du compte à un utilisateur connecté', async () => {
    signIn({ name: 'Karim', role: 'buyer' })
    visit('/parametres')
    expect(await screen.findByRole('heading', { name: 'Paramètres du compte' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Supprimer mon compte' })).toBeTruthy()
  })
})

describe('vérification de l’e-mail (SCRUM-24)', () => {
  it('envoie un compte non vérifié sur « Consultez votre boîte mail »', async () => {
    signIn({ name: 'Karim', email: 'karim@test.tn', role: 'buyer', email_verified: false })
    const router = visit('/porteur')
    expect(await screen.findByRole('heading', { name: 'Consultez votre boîte mail' })).toBeTruthy()
    expect(screen.getByText('karim@test.tn')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Renvoyer le lien' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/verification-email')
  })

  it('vérifie le lien une seule fois et transmet ses paramètres à l’API', async () => {
    vi.mocked(http.get).mockResolvedValue({
      data: { user: { id: 1, name: 'Karim', role: 'buyer', email_verified: true } },
    })
    visit(VERIFY_LINK)

    expect(await screen.findByRole('heading', { name: 'Adresse e-mail vérifiée' })).toBeTruthy()
    expect(http.get).toHaveBeenCalledTimes(1)
    expect(http.get).toHaveBeenCalledWith('/auth/email/verify/1/abc', {
      params: { expires: '1999999999', signature: 'sig' },
      skipAuthRedirect: true,
    })
  })

  it('porteur connecté : met à jour son compte et propose son tableau de bord', async () => {
    signIn({ name: 'Karim', role: 'buyer', email_verified: false })
    vi.mocked(http.get).mockResolvedValue({
      data: { user: { id: 1, name: 'Karim', role: 'buyer', email_verified: true } },
    })
    visit(VERIFY_LINK)

    const link = await screen.findByRole('link', { name: 'Accéder à mon tableau de bord' })
    expect(link.getAttribute('href')).toBe('/porteur')
    expect(useAuthStore.getState().user.email_verified).toBe(true)
  })

  it('fournisseur : envoie vers « Compte en attente de validation »', async () => {
    signIn({ name: 'Amel', role: 'supplier', email_verified: false })
    vi.mocked(http.get).mockResolvedValue({
      data: {
        user: { id: 1, name: 'Amel', role: 'supplier', email_verified: true, supplier_validation_status: 'en attente' },
      },
    })
    visit(VERIFY_LINK)

    const link = await screen.findByRole('link', { name: "Voir l'état de mon compte" })
    expect(link.getAttribute('href')).toBe('/fournisseur/en-attente')
  })

  it('fournisseur en attente : le tableau de bord renvoie vers « Compte en attente de validation »', async () => {
    signIn({ name: 'Amel', role: 'supplier', supplier_validation_status: 'en attente' })
    visit('/fournisseur')
    expect(await screen.findByRole('heading', { name: 'Compte en attente de validation' })).toBeTruthy()
  })

  it('affiche un message clair pour un lien expiré ou déjà utilisé', async () => {
    vi.mocked(http.get).mockRejectedValueOnce(apiError(410, { reason: 'expired', message: 'Lien expiré.' }))
    visit(VERIFY_LINK)
    expect(await screen.findByRole('heading', { name: 'Lien expiré' })).toBeTruthy()
    cleanup()

    vi.mocked(http.get).mockRejectedValueOnce(apiError(409, { reason: 'already_verified', message: 'Déjà.' }))
    visit(VERIFY_LINK)
    expect(await screen.findByRole('heading', { name: 'Lien déjà utilisé' })).toBeTruthy()
  })

  it('refuse un lien incomplet sans appeler l’API', async () => {
    visit('/email/verifier?id=1')
    expect(await screen.findByRole('heading', { name: 'Lien invalide' })).toBeTruthy()
    expect(http.get).not.toHaveBeenCalled()
  })
})
