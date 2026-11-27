import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { sendChatbotMessage } from '@/api/chatbot'
import { useAuthStore } from '@/stores/auth'
import ChatbotWidget from './ChatbotWidget'

vi.mock('@/api/http', () => ({ http: { get: vi.fn(), post: vi.fn() }, onAuthError: vi.fn() }))
vi.mock('@/api/chatbot', () => ({ sendChatbotMessage: vi.fn() }))

function renderWidget(path = '/porteur') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <ChatbotWidget />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useAuthStore.setState({ user: { id: 1, role: 'buyer', email_verified: true }, token: 't', loaded: true })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('ChatbotWidget (SCRUM-85)', () => {
  it('s’ouvre depuis le bouton flottant et se ferme avec Échap', () => {
    renderWidget()

    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir l’assistant' }))
    expect(screen.getByRole('dialog', { name: 'Assistant TijaraLink' })).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('envoie la question avec la page et affiche la réponse et ses liens', async () => {
    sendChatbotMessage.mockResolvedValue({
      answer: 'Ouvrez « Mes demandes » puis « Publier une demande ».',
      links: [{ label: 'Publier une demande', path: '/porteur/demandes/nouvelle' }],
    })
    renderWidget()
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir l’assistant' }))

    fireEvent.change(screen.getByLabelText('Votre question'), { target: { value: 'Comment publier ?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }))

    expect(await screen.findByText('Ouvrez « Mes demandes » puis « Publier une demande ».')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Publier une demande →' }).getAttribute('href')).toBe('/porteur/demandes/nouvelle')
    expect(sendChatbotMessage).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Comment publier ?', page: '/porteur', history: [expect.objectContaining({ from: 'assistant' })] }),
    )
  })

  it('propose des questions fréquentes', async () => {
    sendChatbotMessage.mockResolvedValue({ answer: 'Voici comment suivre une commande.', links: [] })
    renderWidget()
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir l’assistant' }))

    fireEvent.click(screen.getByRole('button', { name: 'Comment suivre ma commande ?' }))

    expect(await screen.findByText('Voici comment suivre une commande.')).toBeTruthy()
  })

  it('affiche un message clair si l’assistant est indisponible', async () => {
    sendChatbotMessage.mockRejectedValue({ response: { data: { message: "L'aide de l'IA n'est pas disponible pour le moment." } } })
    renderWidget()
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir l’assistant' }))

    fireEvent.change(screen.getByLabelText('Votre question'), { target: { value: 'Aide' } })
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }))

    expect(await screen.findByText("L'aide de l'IA n'est pas disponible pour le moment.")).toBeTruthy()
  })

  it('invite un visiteur à se connecter', () => {
    useAuthStore.setState({ user: null, token: null, loaded: true })
    renderWidget('/catalogue')
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir l’assistant' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).queryByLabelText('Votre question')).toBeNull()
    expect(within(dialog).getByRole('link', { name: 'Se connecter' }).getAttribute('href')).toBe('/connexion?redirect=%2Fcatalogue')
  })
})
