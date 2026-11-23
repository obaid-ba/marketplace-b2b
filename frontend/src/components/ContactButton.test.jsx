import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter, useLocation } from 'react-router'
import { openConversation } from '@/api/messaging'
import { useAuthStore } from '@/stores/auth'
import ContactButton from './ContactButton'

vi.mock('@/api/messaging', () => ({ openConversation: vi.fn() }))

function Here() {
  const location = useLocation()
  return <p data-testid="here">{location.pathname + location.search + (location.state?.draft ?? '')}</p>
}

function show(props, role) {
  useAuthStore.setState({ user: role ? { id: 1, role, email_verified: true } : null, token: role ? 't' : null, loaded: true })
  const router = createMemoryRouter(
    [
      { path: '/fiche', element: <ContactButton {...props} /> },
      { path: '*', element: <Here /> },
    ],
    { initialEntries: ['/fiche'] },
  )
  render(<RouterProvider router={router} />)
}

beforeEach(() => {
  vi.mocked(openConversation).mockReset()
})
afterEach(cleanup)

describe('ContactButton (SCRUM-61)', () => {
  it('envoie un visiteur vers la connexion puis le ramène sur la fiche', async () => {
    show({ supplierId: 3 })
    fireEvent.click(screen.getByRole('button', { name: 'Contacter' }))
    expect((await screen.findByTestId('here')).textContent).toBe('/connexion?redirect=%2Ffiche')
    expect(openConversation).not.toHaveBeenCalled()
  })

  it('ouvre la conversation du porteur avec le brouillon proposé', async () => {
    vi.mocked(openConversation).mockResolvedValue({ id: 42 })
    show({ supplierId: 3, draft: '|Bonjour' }, 'buyer')
    fireEvent.click(screen.getByRole('button', { name: 'Contacter' }))
    expect((await screen.findByTestId('here')).textContent).toBe('/porteur/messagerie/42|Bonjour')
    expect(openConversation).toHaveBeenCalledWith({ context_type: 'direct', context_id: undefined, supplier_id: 3 })
  })

  it('le contact direct est masqué pour un fournisseur, pas la conversation d’une commande', async () => {
    show({ supplierId: 3 }, 'supplier')
    expect(screen.queryByRole('button')).toBeNull()
    cleanup()

    vi.mocked(openConversation).mockResolvedValue({ id: 8 })
    show({ contextType: 'commande', contextId: 12 }, 'supplier')
    fireEvent.click(screen.getByRole('button', { name: 'Contacter' }))
    expect((await screen.findByTestId('here')).textContent).toBe('/fournisseur/messagerie/8')
  })

  it('affiche le refus de l’API', async () => {
    vi.mocked(openConversation).mockRejectedValue(Object.assign(new Error(), { userMessage: "Ce fournisseur n'est pas disponible." }))
    show({ supplierId: 3 }, 'buyer')
    fireEvent.click(screen.getByRole('button', { name: 'Contacter' }))
    expect((await screen.findByRole('alert')).textContent).toBe("Ce fournisseur n'est pas disponible.")
  })
})
