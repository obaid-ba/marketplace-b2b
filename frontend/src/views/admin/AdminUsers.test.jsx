import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { http } from '@/api/http'
import { createRoutes } from '@/router/routes'
import { useAuthStore } from '@/stores/auth'

vi.mock('@/api/http', () => ({ http: { get: vi.fn(), post: vi.fn() }, onAuthError: vi.fn() }))

const account = (overrides = {}) => ({
  id: 7,
  name: 'Sami Vendeur',
  email: 'sami@test.tn',
  phone: '+216 71000111',
  role: 'supplier',
  role_label: 'Fournisseur',
  status: 'actif',
  email_verified: true,
  organization: 'Atlas SARL',
  supplier: { id: 3, validation_status: 'validé', is_published: true, rating_avg: 4.5, reviews_count: 8 },
  created_at: '2026-11-01T10:00:00+01:00',
  last_login_at: null,
  deleted_at: null,
  can_suspend: true,
  can_reactivate: false,
  locked_reason: null,
  ...overrides,
})

const detail = (user = {}, extra = {}) => ({
  user: account(user),
  activity: { orders: 5, ongoing_orders: 2, open_disputes: 0, products: 12, quotes: 4 },
  history: [],
  ...extra,
})

const suspended = detail(
  { status: 'suspendu', can_suspend: false, can_reactivate: true },
  { history: [{ id: 1, action: 'user.suspended', reason: 'Annonces trompeuses.', admin: 'Sonia', created_at: '2026-11-23T10:00:00+01:00' }] },
)

let replies

beforeEach(() => {
  replies = { '/notifications/unread-count': { count: 0 } }
  useAuthStore.setState({ user: { id: 1, name: 'Admin', role: 'admin', email_verified: true }, token: 't', loaded: true })
  vi.mocked(http.get).mockReset()
  vi.mocked(http.post).mockReset()
  vi.mocked(http.get).mockImplementation(async (url) => {
    if (replies[url] === undefined) throw Object.assign(new Error(url), { response: { status: 404 } })
    return { data: replies[url] }
  })
})

afterEach(cleanup)

function visit(path) {
  const router = createMemoryRouter(createRoutes(), { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

describe('Utilisateurs (SCRUM-118)', () => {
  beforeEach(() => {
    replies['/admin/users'] = {
      data: [account()],
      meta: { current_page: 1, last_page: 3, total: 41 },
      counts: { actif: 38, suspendu: 2, désactivé: 1, 'e-mail à vérifier': 0, supprimé: 4 },
    }
  })

  it('liste les comptes avec leur société et leur statut', async () => {
    visit('/admin/utilisateurs')
    expect((await screen.findByText('Sami Vendeur')).closest('a').getAttribute('href')).toBe('/admin/utilisateurs/7')
    expect(screen.getByText('Atlas SARL · sami@test.tn')).toBeTruthy()
    expect(screen.getByText('Jamais connecté')).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Suspendu (2)' })).toBeTruthy()
  })

  it('filtre, recherche et revient à la première page', async () => {
    const router = visit('/admin/utilisateurs?page=3')
    await screen.findByText('Sami Vendeur')
    fireEvent.change(screen.getByLabelText('Statut'), { target: { value: 'suspendu' } })
    await waitFor(() => expect(router.state.location.search).toBe('?statut=suspendu'))
    fireEvent.change(screen.getByLabelText('Rechercher un utilisateur'), { target: { value: '  atlas ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }))

    await waitFor(() =>
      expect(http.get).toHaveBeenLastCalledWith('/admin/users', { params: expect.objectContaining({ status: 'suspendu', search: 'atlas', page: 1 }) }),
    )
    expect(router.state.location.search).toBe('?statut=suspendu&q=atlas')
  })

  it('change de page en gardant les filtres', async () => {
    visit('/admin/utilisateurs?role=supplier')
    await screen.findByText('Sami Vendeur')
    fireEvent.click(screen.getByRole('button', { name: 'Page suivante' }))
    await waitFor(() => expect(http.get).toHaveBeenLastCalledWith('/admin/users', { params: expect.objectContaining({ role: 'supplier', page: 2 }) }))
  })

  it('est refusée à un fournisseur', async () => {
    useAuthStore.setState({ user: { id: 2, role: 'supplier', email_verified: true, supplier_validation_status: 'validé' } })
    visit('/admin/utilisateurs')
    expect(await screen.findByText('Accès refusé')).toBeTruthy()
  })
})

describe('Fiche utilisateur (SCRUM-118)', () => {
  it('suspend avec un motif obligatoire, après avoir annoncé les conséquences', async () => {
    replies['/admin/users/7'] = detail()
    vi.mocked(http.post).mockResolvedValue({ data: suspended })
    visit('/admin/utilisateurs/7')

    fireEvent.click(await screen.findByRole('button', { name: 'Suspendre' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/disparaissent du catalogue/)).toBeTruthy()
    expect(within(dialog).getByText(/2 commandes en cours ne pourront plus avancer/)).toBeTruthy()

    const confirm = within(dialog).getByRole('button', { name: 'Suspendre le compte' })
    fireEvent.change(within(dialog).getByLabelText(/Motif/), { target: { value: '   court   ' } })
    expect(confirm.disabled).toBe(true)
    fireEvent.change(within(dialog).getByLabelText(/Motif/), { target: { value: ' Annonces trompeuses. ' } })
    fireEvent.click(confirm)

    expect((await screen.findByRole('status')).textContent).toMatch(/Compte suspendu/)
    expect(http.post).toHaveBeenCalledWith('/admin/users/7/suspend', { reason: 'Annonces trompeuses.' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Suspendre' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Réactiver' })).toBeTruthy()
    expect(screen.getByText('Annonces trompeuses.')).toBeTruthy()
  })

  it('réactive un compte', async () => {
    replies['/admin/users/7'] = suspended
    vi.mocked(http.post).mockResolvedValue({ data: detail() })
    visit('/admin/utilisateurs/7')
    fireEvent.click(await screen.findByRole('button', { name: 'Réactiver' }))
    fireEvent.change(screen.getByLabelText(/Motif/), { target: { value: 'Situation régularisée.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Réactiver le compte' }))
    expect((await screen.findByRole('status')).textContent).toMatch(/Compte réactivé/)
    expect(http.post).toHaveBeenCalledWith('/admin/users/7/reactivate', { reason: 'Situation régularisée.' })
  })

  it('n’avertit d’aucune commande en cours s’il n’y en a pas, ni du catalogue pour un porteur', async () => {
    replies['/admin/users/7'] = detail({ role: 'buyer', role_label: 'Porteur de projet', supplier: null }, { activity: { orders: 0, ongoing_orders: 0, open_disputes: 0, tenders: 0 } })
    visit('/admin/utilisateurs/7')
    fireEvent.click(await screen.findByRole('button', { name: 'Suspendre' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).queryByText(/catalogue/)).toBeNull()
    expect(within(dialog).queryByText(/ne pourr.* plus avancer/)).toBeNull()
  })

  it('un compte administrateur ne se modifie pas', async () => {
    replies['/admin/users/7'] = detail(
      { role: 'admin', supplier: null, can_suspend: false, locked_reason: 'Un compte administrateur ne se gère pas depuis cette page.' },
      { activity: [] },
    )
    visit('/admin/utilisateurs/7')
    expect(await screen.findByText(/ne se gère pas depuis cette page/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Suspendre' })).toBeNull()
    expect(screen.queryByText('Activité')).toBeNull()
  })

  it('affiche le refus de l’API et recharge la fiche', async () => {
    replies['/admin/users/7'] = detail()
    vi.mocked(http.post).mockRejectedValue(
      Object.assign(new Error(), { response: { status: 422 }, userMessage: 'Ce compte est déjà suspendu.', fieldErrors: { user: ['Ce compte est déjà suspendu.'] } }),
    )
    visit('/admin/utilisateurs/7')
    fireEvent.click(await screen.findByRole('button', { name: 'Suspendre' }))
    fireEvent.change(screen.getByLabelText(/Motif/), { target: { value: 'Annonces trompeuses.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Suspendre le compte' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Ce compte est déjà suspendu.')
    await waitFor(() => expect(vi.mocked(http.get).mock.calls.filter(([url]) => url === '/admin/users/7')).toHaveLength(2))
  })

  it('signale un utilisateur introuvable', async () => {
    visit('/admin/utilisateurs/99')
    expect(await screen.findByText('Utilisateur introuvable.')).toBeTruthy()
  })
})
