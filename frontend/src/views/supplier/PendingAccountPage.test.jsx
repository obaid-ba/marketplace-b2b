import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { fetchValidationStatus } from '@/api/supplierValidation'
import { addSupplierDocument } from '@/api/supplierProfile'
import { useAuthStore } from '@/stores/auth'
import PendingAccountPage from './PendingAccountPage'

vi.mock('@/api/http', () => ({ http: { get: vi.fn(), post: vi.fn() }, onAuthError: vi.fn() }))
vi.mock('@/api/supplierValidation', () => ({ fetchValidationStatus: vi.fn() }))
vi.mock('@/api/supplierProfile', () => ({ addSupplierDocument: vi.fn() }))

const fetchMe = vi.fn()
const logout = vi.fn()

function status(overrides = {}) {
  return {
    status: 'en attente',
    rejection_reason: null,
    steps: {
      account_created_at: '2026-11-13T09:12:00+01:00',
      email_verified_at: '2026-11-13T09:20:00+01:00',
      reviewed_at: null,
    },
    is_published: false,
    documents: [],
    ...overrides,
  }
}

function renderPage() {
  const router = createMemoryRouter(
    [
      { path: '/fournisseur/en-attente', Component: PendingAccountPage },
      { path: '/fournisseur', element: <h1>Tableau de bord</h1> },
      { path: '/fournisseur/profil', element: <h1>Profil</h1> },
      { path: '/connexion', element: <h1>Connexion</h1> },
    ],
    { initialEntries: ['/fournisseur/en-attente'] },
  )
  render(<RouterProvider router={router} />)
  return router
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-13T15:00:00+01:00'))
  fetchMe.mockReset().mockResolvedValue()
  logout.mockReset().mockResolvedValue()
  useAuthStore.setState({ user: { id: 1, role: 'supplier' }, token: 't', loaded: true, fetchMe, logout })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.mocked(fetchValidationStatus).mockReset()
  vi.mocked(addSupplierDocument).mockReset()
})

describe('PendingAccountPage', () => {
  it('affiche la frise « en cours d’examen » et le bouton vers le profil', async () => {
    vi.mocked(fetchValidationStatus).mockResolvedValue(status())
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Compte en attente de validation' })).toBeTruthy()
    const steps = within(screen.getByRole('list', { name: 'Étapes de validation du compte' })).getAllByRole('listitem')
    expect(steps).toHaveLength(4)
    expect(steps[0].textContent).toContain('Terminé')
    expect(steps[1].textContent).toContain('Terminé')
    expect(steps[2].textContent).toContain('En cours')
    expect(steps[2].textContent).toContain('Délai habituel : 24 à 48 h')
    expect(steps[3].textContent).toContain('À venir')
    expect(screen.getByRole('link', { name: 'Préparer mon profil (sans le publier)' }).getAttribute('href')).toBe(
      '/fournisseur/profil',
    )
    expect(screen.queryByRole('heading', { name: 'Renvoyer mes documents' })).toBeNull()
  })

  it('dossier refusé : affiche le motif, puis repasse en attente après le renvoi d’un document', async () => {
    vi.mocked(fetchValidationStatus)
      .mockResolvedValueOnce(status({ status: 'refusé', rejection_reason: 'Registre illisible.' }))
      .mockResolvedValueOnce(status())
    vi.mocked(addSupplierDocument).mockResolvedValue({
      message: "Document envoyé. Votre dossier repasse en cours d'examen.",
    })
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Dossier refusé' })).toBeTruthy()
    expect(screen.getByText('Registre illisible.')).toBeTruthy()
    expect(screen.getByText('Refusé')).toBeTruthy()

    const file = new File(['%PDF'], 'registre.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText('Type de document'), { target: { value: 'registre de commerce' } })
    fireEvent.change(screen.getByLabelText('Fichier'), { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer le document' }))

    expect(await screen.findByRole('heading', { name: 'Compte en attente de validation' })).toBeTruthy()
    expect(addSupplierDocument).toHaveBeenCalledWith('registre de commerce', file)
    expect(screen.getByRole('status').textContent).toContain('repasse en cours')
    expect(fetchMe).toHaveBeenCalled()
  })

  it('refuse un fichier au mauvais format sans appeler l’API', async () => {
    vi.mocked(fetchValidationStatus).mockResolvedValue(status({ status: 'refusé', rejection_reason: 'Motif.' }))
    renderPage()
    await screen.findByRole('heading', { name: 'Dossier refusé' })

    fireEvent.change(screen.getByLabelText('Type de document'), { target: { value: 'certification' } })
    fireEvent.change(screen.getByLabelText('Fichier'), {
      target: { files: [new File(['x'], 'virus.exe', { type: 'application/octet-stream' })] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer le document' }))

    expect(await screen.findByText('Le document doit être un PDF ou une image (JPG, PNG).')).toBeTruthy()
    expect(addSupplierDocument).not.toHaveBeenCalled()
  })

  it('compte validé : redirige vers le tableau de bord', async () => {
    vi.mocked(fetchValidationStatus).mockResolvedValue(status({ status: 'validé' }))
    const router = renderPage()

    await waitFor(() => expect(router.state.location.pathname).toBe('/fournisseur'))
    expect(fetchMe).toHaveBeenCalled()
  })

  it('se déconnecte et revient à la connexion', async () => {
    vi.mocked(fetchValidationStatus).mockResolvedValue(status())
    const router = renderPage()
    await screen.findByRole('heading', { name: 'Compte en attente de validation' })

    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/connexion'))
    expect(logout).toHaveBeenCalled()
  })
})
