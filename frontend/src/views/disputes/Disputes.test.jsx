import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, RouterProvider, createMemoryRouter } from 'react-router'
import { http } from '@/api/http'
import OrderDisputeCard from '@/components/disputes/OrderDisputeCard'
import { emitRealtime } from '@/realtime/realtime'
import { createRoutes } from '@/router/routes'
import { useAuthStore } from '@/stores/auth'

vi.mock('@/api/http', () => ({ http: { get: vi.fn(), post: vi.fn() }, onAuthError: vi.fn() }))

const REASONS = ['Commande non reçue', 'Produit endommagé', 'Autre problème']
const DECISIONS = ['Remboursement total', 'Remboursement partiel', 'Remplacement du produit', 'Réclamation rejetée']

const dispute = (overrides = {}) => ({
  id: 5,
  order_id: 12,
  reason: 'Produit endommagé',
  description: 'Deux cartons écrasés sur dix.',
  status: 'ouvert',
  decision: null,
  decision_note: null,
  decided_at: null,
  created_at: '2026-11-23T10:00:00+01:00',
  order: { id: 12, status: 'livrée', total: 450, created_at: '2026-11-20T10:00:00+01:00' },
  buyer: { name: 'Atelier Amel' },
  supplier: { name: 'Atlas SARL' },
  attachments: [{ id: 3, original_name: 'carton.jpg', mime: 'image/jpeg', size: 2048 }],
  ...overrides,
})

function apiError(status, message, errors = {}) {
  return Object.assign(new Error(message), { response: { status, data: { message } }, userMessage: message, fieldErrors: errors })
}

/** Réponses GET par adresse ; une fonction est rappelée à chaque demande. */
let replies

beforeEach(() => {
  replies = { '/notifications/unread-count': { count: 0 }, '/conversations/unread-count': { count: 0 } }
  vi.mocked(http.get).mockReset()
  vi.mocked(http.post).mockReset()
  vi.mocked(http.get).mockImplementation(async (url, config) => {
    const reply = replies[url]
    if (reply === undefined) throw apiError(404, 'Introuvable')
    return { data: typeof reply === 'function' ? reply(config) : reply }
  })
})

afterEach(cleanup)

function signIn(role) {
  useAuthStore.setState({
    user: { id: 1, name: 'Moi', role, email_verified: true, supplier_validation_status: 'validé' },
    token: 't',
    loaded: true,
  })
}

function visit(path) {
  const router = createMemoryRouter(createRoutes(), { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

describe('Bloc « Litige » d’une commande (SCRUM-117)', () => {
  const show = () =>
    render(
      <MemoryRouter>
        <OrderDisputeCard orderId={12} />
      </MemoryRouter>,
    )

  it('propose de signaler un problème quand c’est possible', async () => {
    replies['/orders/12/dispute'] = { dispute: null, can_open: true, reasons: REASONS }
    show()
    expect((await screen.findByRole('link', { name: 'Signaler un problème' })).getAttribute('href')).toBe('/porteur/commandes/12/litige')
  })

  it('n’affiche rien sans litige ni possibilité d’en ouvrir', async () => {
    replies['/orders/12/dispute'] = { dispute: null, can_open: false, reasons: [] }
    show()
    await waitFor(() => expect(http.get).toHaveBeenCalled())
    expect(screen.queryByRole('region', { name: 'Litige' })).toBeNull()
  })

  it('suit le litige et se met à jour quand une notification arrive', async () => {
    let current = { id: 5, status: 'en cours', reason: 'Produit endommagé', decision: null }
    replies['/orders/12/dispute'] = () => ({ dispute: current, can_open: false, reasons: [] })
    show()
    expect(await screen.findByText('En cours')).toBeTruthy()
    expect(screen.getByText(/pourra être clôturée après la décision/)).toBeTruthy()

    current = { ...current, status: 'décidé', decision: 'Remboursement total' }
    await act(async () => emitRealtime('notification.created', {}))
    expect(await screen.findByText('Décision : Remboursement total')).toBeTruthy()
    expect(screen.queryByText(/pourra être clôturée/)).toBeNull()
  })
})

describe('Signaler un problème (SCRUM-117)', () => {
  beforeEach(() => {
    signIn('buyer')
    replies['/orders/12/dispute'] = { dispute: null, can_open: true, reasons: REASONS }
  })

  it('contrôle le motif, la description et les fichiers avant l’envoi', async () => {
    visit('/porteur/commandes/12/litige')
    fireEvent.click(await screen.findByRole('button', { name: 'Ouvrir le litige' }))
    expect(screen.getByText('Choisissez le motif du problème.')).toBeTruthy()
    expect(screen.getByText(/20 caractères au moins/)).toBeTruthy()

    const input = screen.getByLabelText(/Photos ou documents/)
    fireEvent.change(input, { target: { files: [new File(['x'], 'page.html')] } })
    expect(screen.getByText(/formats acceptés/)).toBeTruthy()
    fireEvent.change(input, { target: { files: Array.from({ length: 6 }, (_, i) => new File(['x'], `${i}.jpg`)) } })
    expect(screen.getByText('5 fichiers au maximum.')).toBeTruthy()
    expect(http.post).not.toHaveBeenCalled()
  })

  it('envoie le litige avec ses preuves puis l’affiche', async () => {
    replies['/disputes/5'] = dispute()
    vi.mocked(http.post).mockResolvedValue({ data: { id: 5 } })
    const router = visit('/porteur/commandes/12/litige')

    fireEvent.click(await screen.findByLabelText('Produit endommagé'))
    fireEvent.change(screen.getByLabelText("Que s'est-il passé ?"), { target: { value: '  Deux cartons écrasés sur dix.  ' } })
    const input = screen.getByLabelText(/Photos ou documents/)
    fireEvent.change(input, { target: { files: [new File(['a'], 'a.jpg'), new File(['b'], 'b.pdf')] } })
    fireEvent.click(screen.getByRole('button', { name: 'Retirer a.jpg' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le litige' }))

    expect(await screen.findByRole('heading', { name: 'Litige — commande n° 12' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/litiges/5')
    const [url, form] = vi.mocked(http.post).mock.calls[0]
    expect(url).toBe('/buyer/orders/12/dispute')
    expect(form.get('reason')).toBe('Produit endommagé')
    expect(form.get('description')).toBe('Deux cartons écrasés sur dix.')
    expect(form.getAll('attachments[]').map((file) => file.name)).toEqual(['b.pdf'])
  })

  it('affiche l’erreur de l’API et garde la saisie', async () => {
    vi.mocked(http.post).mockRejectedValue(apiError(422, 'Un litige est déjà en cours pour cette commande.', { order: ['…'] }))
    visit('/porteur/commandes/12/litige')
    fireEvent.click(await screen.findByLabelText('Produit endommagé'))
    const text = screen.getByLabelText("Que s'est-il passé ?")
    fireEvent.change(text, { target: { value: 'Deux cartons écrasés sur dix.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le litige' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/déjà en cours/)
    expect(text.value).toBe('Deux cartons écrasés sur dix.')
  })

  it('explique pourquoi ce n’est pas possible', async () => {
    replies['/orders/12/dispute'] = { dispute: null, can_open: false, reasons: [] }
    visit('/porteur/commandes/12/litige')
    expect(await screen.findByText(/de l'expédition à la livraison/)).toBeTruthy()
  })
})

describe('Litige vu par les parties (SCRUM-117)', () => {
  it('montre la décision motivée au fournisseur', async () => {
    signIn('supplier')
    replies['/disputes/5'] = dispute({ status: 'décidé', decision: 'Remboursement partiel', decision_note: 'Photos à l’appui.', decided_at: '2026-11-24T09:00:00+01:00' })
    visit('/litiges/5')
    expect(await screen.findByText('Remboursement partiel')).toBeTruthy()
    expect(screen.getByText('Photos à l’appui.')).toBeTruthy()
    expect(screen.getByRole('button', { name: "Contacter l'acheteur" })).toBeTruthy()
    expect(screen.getByRole('button', { name: /carton\.jpg/ })).toBeTruthy()
  })

  it('un litige d’autrui est introuvable', async () => {
    signIn('buyer')
    visit('/litiges/99')
    expect(await screen.findByText('Litige introuvable.')).toBeTruthy()
  })
})

describe('Gestion des litiges par l’admin (SCRUM-117)', () => {
  const list = { data: [dispute({ assigned_admin: null })], meta: { current_page: 1, last_page: 1, total: 1 }, counts: { ouvert: 1, 'en cours': 2, décidé: 4 } }
  const taken = dispute({ status: 'en cours', assigned_admin: { id: 1, name: 'Moi' } })

  beforeEach(() => signIn('admin'))

  it('liste la file avec ses compteurs et filtre par statut', async () => {
    replies['/admin/disputes'] = list
    const router = visit('/admin/litiges')
    expect((await screen.findByText('Commande n° 12')).closest('a').getAttribute('href')).toBe('/admin/litiges/5')
    expect(screen.getByRole('button', { name: 'Tous (7)' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Ouverts (1)' }))
    await waitFor(() => expect(http.get).toHaveBeenLastCalledWith('/admin/disputes', { params: expect.objectContaining({ status: 'ouvert', page: 1 }) }))
    expect(router.state.location.search).toBe('?statut=ouvert')
  })

  it('prend en charge, puis rend une décision motivée après confirmation', async () => {
    replies['/admin/disputes/5'] = { data: dispute({ assigned_admin: null }), decisions: DECISIONS }
    vi.mocked(http.post).mockResolvedValueOnce({ data: { data: taken, decisions: DECISIONS } })
    visit('/admin/litiges/5')
    fireEvent.click(await screen.findByRole('button', { name: 'Prendre en charge' }))

    const submit = await screen.findByRole('button', { name: 'Rendre la décision' })
    fireEvent.click(screen.getByLabelText('Remboursement partiel'))
    expect(submit.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(/Motif, envoyé/), { target: { value: ' Photos à l’appui. ' } })
    fireEvent.click(submit)

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/définitive/)).toBeTruthy()
    vi.mocked(http.post).mockResolvedValueOnce({
      data: { data: dispute({ status: 'décidé', decision: 'Remboursement partiel', decision_note: 'Photos à l’appui.', decided_at: '2026-11-24T09:00:00+01:00' }), decisions: DECISIONS },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmer la décision' }))

    expect(await screen.findByText("Décision de l'administrateur")).toBeTruthy()
    expect(http.post).toHaveBeenLastCalledWith('/admin/disputes/5/decide', { decision: 'Remboursement partiel', note: 'Photos à l’appui.' })
    expect(screen.queryByRole('button', { name: 'Rendre la décision' })).toBeNull()
  })

  it('un litige pris par un collègue se reprend avant de décider', async () => {
    replies['/admin/disputes/5'] = { data: dispute({ status: 'en cours', assigned_admin: { id: 2, name: 'Sonia' } }), decisions: DECISIONS }
    visit('/admin/litiges/5')
    expect(await screen.findByRole('button', { name: 'Reprendre le litige' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Rendre la décision' })).toBeNull()
  })

  it('affiche le refus de l’API et recharge l’état', async () => {
    replies['/admin/disputes/5'] = { data: dispute({ assigned_admin: null }), decisions: DECISIONS }
    vi.mocked(http.post).mockRejectedValue(apiError(422, 'Une décision a déjà été rendue pour ce litige.'))
    visit('/admin/litiges/5')
    fireEvent.click(await screen.findByRole('button', { name: 'Prendre en charge' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/déjà été rendue/)
    await waitFor(() => expect(vi.mocked(http.get).mock.calls.filter(([url]) => url === '/admin/disputes/5')).toHaveLength(2))
  })

  it('est refusée à un porteur', async () => {
    signIn('buyer')
    visit('/admin/litiges')
    expect(await screen.findByText('Accès refusé')).toBeTruthy()
  })
})
