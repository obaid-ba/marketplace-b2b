import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { http } from '@/api/http'
import { emitRealtime } from '@/realtime/realtime'
import { createRoutes } from '@/router/routes'
import { useAuthStore } from '@/stores/auth'
import { useMessagingStore } from '@/stores/messaging'

vi.mock('@/api/http', () => ({ http: { get: vi.fn(), post: vi.fn() }, onAuthError: vi.fn() }))

const conversation = (overrides = {}) => ({
  id: 7,
  party: { name: 'Atlas SARL', contact: null, avatar_url: null, supplier_id: 3 },
  context: { type: 'commande', id: 12, label: 'Commande n° 12', url: '/orders/12' },
  unread_count: 0,
  other_last_read_message_id: null,
  last_message: { id: 2, body: 'Oui, 300 sacs.', is_mine: false },
  last_message_at: '2026-11-23T10:00:00+01:00',
  ...overrides,
})

const message = (id, body, isMine, extra = {}) => ({
  id,
  conversation_id: 7,
  sender_id: isMine ? 1 : 9,
  is_mine: isMine,
  body,
  attachment: null,
  sent_at: '2026-11-23T10:00:00+01:00',
  ...extra,
})

/** API simulée : server.messages est la base, modifiable pendant le test. */
let server

beforeEach(() => {
  server = {
    list: [conversation({ unread_count: 2 })],
    detail: conversation({ unread_count: 2 }),
    messages: [message(1, 'Avez-vous du stock ?', true), message(2, 'Oui, 300 sacs.', false)],
    hasMore: false,
  }
  useAuthStore.setState({ user: { id: 1, name: 'Amel', role: 'buyer', email_verified: true }, token: 't', loaded: true })
  useMessagingStore.setState({ unread: 0 })

  vi.mocked(http.get).mockReset()
  vi.mocked(http.post).mockReset()
  vi.mocked(http.get).mockImplementation(async (url, { params } = {}) => {
    if (url === '/conversations') return { data: { data: server.list, meta: { total: server.list.length } } }
    if (url === '/conversations/unread-count') return { data: { count: 2 } }
    if (url === '/notifications/unread-count') return { data: { count: 0 } }
    if (url === '/conversations/7') return { data: server.detail }
    if (url === '/conversations/7/messages') {
      const data = server.messages.filter((m) => (params?.after ? m.id > params.after : params?.before ? m.id < params.before : true))
      return { data: { data, has_more: params?.after || params?.before ? false : server.hasMore } }
    }
    throw Object.assign(new Error(url), { response: { status: 404 } })
  })
  vi.mocked(http.post).mockImplementation(async (url, body) => {
    if (url.endsWith('/read')) return { data: { unread_total: 0 } }
    if (url === '/conversations/7/messages') {
      const sent = message(10, body.body ?? '', true)
      server.messages.push(sent)
      return { data: sent }
    }
    return { data: {} }
  })
})

afterEach(cleanup)

function visit(path) {
  const router = createMemoryRouter(createRoutes(), { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

const thread = () => screen.findByRole('list', { name: 'Messages' })

describe('Messagerie (SCRUM-59 à SCRUM-61)', () => {
  it('liste les conversations avec le contexte, le dernier message et les non lus', async () => {
    visit('/porteur/messagerie')
    const list = await screen.findByRole('region', { name: 'Conversations' })
    expect(await within(list).findByText('Atlas SARL')).toBeTruthy()
    expect(within(list).getByText('Commande n° 12')).toBeTruthy()
    expect(within(list).getByText('Oui, 300 sacs.')).toBeTruthy()
    expect(within(list).getByLabelText('2 messages non lus')).toBeTruthy()
    expect(screen.getByText("Choisissez une conversation pour l'afficher.")).toBeTruthy()
  })

  it('affiche le nombre de messages non lus dans le menu', async () => {
    visit('/porteur/messagerie')
    const nav = await screen.findByRole('navigation', { name: 'Espace porteur de projet' })
    expect(await within(nav).findByLabelText('2 messages non lus')).toBeTruthy()
  })

  it('ouvre le fil, le marque comme lu et propose le lien vers la commande', async () => {
    visit('/porteur/messagerie/7')
    expect(within(await thread()).getByText('Avez-vous du stock ?')).toBeTruthy()
    const panel = screen.getByRole('region', { name: 'Conversation' })
    expect(within(panel).getByRole('link', { name: 'Commande n° 12' }).getAttribute('href')).toBe('/orders/12')
    await waitFor(() => expect(http.post).toHaveBeenCalledWith('/conversations/7/read'))
  })

  it('envoie un message avec Entrée et l’affiche une seule fois, même si l’événement temps réel arrive aussi', async () => {
    visit('/porteur/messagerie/7')
    const input = await screen.findByLabelText('Votre message')
    fireEvent.change(input, { target: { value: '  Parfait, je commande.  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    const list = await thread()
    expect(await within(list).findByText('Parfait, je commande.')).toBeTruthy()
    expect(http.post).toHaveBeenCalledWith('/conversations/7/messages', { body: 'Parfait, je commande.' })
    expect(input.value).toBe('')

    await act(async () => emitRealtime('message.sent', { conversation_id: 7, message_id: 10, sender_id: 1 }))
    expect(within(list).getAllByText('Parfait, je commande.')).toHaveLength(1)
  })

  it('Maj + Entrée n’envoie pas, un message vide ne s’envoie pas', async () => {
    visit('/porteur/messagerie/7')
    const input = await screen.findByLabelText('Votre message')
    expect(screen.getByRole('button', { name: 'Envoyer' }).disabled).toBe(true)
    fireEvent.change(input, { target: { value: 'Ligne 1' } })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    expect(http.post).not.toHaveBeenCalledWith('/conversations/7/messages', expect.anything())
  })

  it('affiche en temps réel un message reçu', async () => {
    visit('/porteur/messagerie/7')
    const list = await thread()
    server.messages.push(message(11, 'Livraison demain.', false))
    await act(async () => emitRealtime('message.sent', { conversation_id: 7, message_id: 11, sender_id: 9 }))
    expect(await within(list).findByText('Livraison demain.')).toBeTruthy()
  })

  it('affiche « Lu » quand l’autre personne a lu, pas quand c’est moi', async () => {
    server.messages = [message(1, 'Bonjour', true)]
    visit('/porteur/messagerie/7')
    const list = await thread()
    await act(async () => emitRealtime('conversation.read', { conversation_id: 7, reader_id: 1, last_read_message_id: 1 }))
    expect(within(list).queryByText(/Lu/)).toBeNull()
    await act(async () => emitRealtime('conversation.read', { conversation_id: 7, reader_id: 9, last_read_message_id: 1 }))
    expect(within(list).getByText(/Lu/)).toBeTruthy()
  })

  it('garde le texte et affiche l’erreur si l’envoi échoue', async () => {
    visit('/porteur/messagerie/7')
    const input = await screen.findByLabelText('Votre message')
    vi.mocked(http.post).mockRejectedValueOnce(Object.assign(new Error(), { userMessage: 'Trop de tentatives. Réessayez dans une minute.' }))
    fireEvent.change(input, { target: { value: 'Bonjour' } })
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/Trop de tentatives/)
    expect(input.value).toBe('Bonjour')
  })

  it('envoie une pièce jointe et refuse un format interdit', async () => {
    visit('/porteur/messagerie/7')
    const file = await screen.findByLabelText('Pièce jointe')
    fireEvent.change(file, { target: { files: [new File(['x'], 'page.html')] } })
    expect((await screen.findByRole('alert')).textContent).toMatch(/Formats acceptés/)

    fireEvent.change(file, { target: { files: [new File(['x'], 'plan.pdf', { type: 'application/pdf' })] } })
    expect(await screen.findByText(/plan\.pdf/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }))
    await waitFor(() => expect(http.post).toHaveBeenCalledWith('/conversations/7/messages', expect.any(FormData), expect.anything()))
    const [, form] = vi.mocked(http.post).mock.calls.find(([url, body]) => url === '/conversations/7/messages' && body instanceof FormData)
    expect(form.get('attachment').name).toBe('plan.pdf')
  })

  it('charge les messages précédents', async () => {
    server.messages = [message(5, 'Récent', false)]
    server.hasMore = true
    visit('/porteur/messagerie/7')
    const list = await thread()
    server.messages.unshift(message(4, 'Ancien', false))
    fireEvent.click(await screen.findByRole('button', { name: 'Messages précédents' }))
    expect(await within(list).findByText('Ancien')).toBeTruthy()
  })

  it('signale une conversation introuvable', async () => {
    visit('/porteur/messagerie/99')
    expect(await screen.findByText('Conversation introuvable')).toBeTruthy()
  })

  it('est ouverte au fournisseur validé dans son espace', async () => {
    useAuthStore.setState({ user: { id: 9, name: 'Sami', role: 'supplier', email_verified: true, supplier_validation_status: 'validé' } })
    visit('/fournisseur/messagerie')
    const list = await screen.findByRole('region', { name: 'Conversations' })
    const link = (await within(list).findByText('Atlas SARL')).closest('a')
    expect(link.getAttribute('href')).toBe('/fournisseur/messagerie/7')
  })
})
