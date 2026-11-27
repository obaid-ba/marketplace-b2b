import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { fetchNotificationPreferences, setWhatsAppConsent, updateNotificationPreferences } from '@/api/notifications'
import { useAuthStore } from '@/stores/auth'
import NotificationPreferencesPage from './NotificationPreferencesPage'

vi.mock('@/api/notifications', () => ({
  fetchNotificationPreferences: vi.fn(),
  updateNotificationPreferences: vi.fn(),
  setWhatsAppConsent: vi.fn(),
}))

const channel = (enabled, locked = false) => ({ enabled, locked })

const rows = (withWhatsApp) => [
  {
    event_type: 'order_validated',
    label: 'Commande validée',
    critical_email: true,
    channels: { site: channel(true), email: channel(true, true), ...(withWhatsApp && { whatsapp: channel(true) }) },
  },
  {
    event_type: 'message_received',
    label: 'Nouveau message',
    critical_email: false,
    channels: { site: channel(true), email: channel(true), ...(withWhatsApp && { whatsapp: channel(false) }) },
  },
]

const whatsapp = (overrides = {}) => ({ available: true, simulated: true, opted_in: false, active: false, phone: '+216 •• ••• 456', recent: [], ...overrides })
const off = (overrides) => ({ preferences: rows(false), whatsapp: whatsapp(overrides) })
const on = (overrides) => ({ preferences: rows(true), whatsapp: whatsapp({ opted_in: true, active: true, ...overrides }) })

function show() {
  render(
    <MemoryRouter>
      <NotificationPreferencesPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  useAuthStore.setState({ user: { id: 1, role: 'buyer', email_verified: true }, token: 't', loaded: true })
  vi.mocked(fetchNotificationPreferences).mockReset()
  vi.mocked(updateNotificationPreferences).mockReset()
  vi.mocked(setWhatsAppConsent).mockReset()
})

afterEach(cleanup)

describe('Préférences de notification (SCRUM-63, SCRUM-133)', () => {
  it('sans consentement, la colonne WhatsApp n’existe pas et l’enregistrement ne l’envoie pas', async () => {
    vi.mocked(fetchNotificationPreferences).mockResolvedValue(off())
    vi.mocked(updateNotificationPreferences).mockResolvedValue(off())
    show()
    const table = await screen.findByRole('table')
    expect(within(table).queryByText('WhatsApp')).toBeNull()

    fireEvent.click(screen.getByLabelText('Nouveau message — par e-mail'))
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les préférences' }))
    expect(await screen.findByText('Vos préférences sont enregistrées.')).toBeTruthy()
    const [sent] = vi.mocked(updateNotificationPreferences).mock.calls[0]
    expect(sent).toHaveLength(4)
    expect(sent).toContainEqual({ event_type: 'message_received', channel: 'email', enabled: false })
  })

  it('active WhatsApp après accord, sans perdre les cases pas encore enregistrées', async () => {
    vi.mocked(fetchNotificationPreferences).mockResolvedValue(off())
    vi.mocked(setWhatsAppConsent).mockResolvedValue({ ...on(), message: 'Notifications WhatsApp activées.' })
    show()
    await screen.findByRole('table')
    expect(screen.getByText("Mode simulé, rien n'est envoyé")).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Nouveau message — par e-mail')) // pas enregistré

    fireEvent.click(screen.getByRole('button', { name: "J'accepte et j'active" }))
    expect(await screen.findByText('Notifications WhatsApp activées.')).toBeTruthy()
    expect(setWhatsAppConsent).toHaveBeenCalledWith(true)
    expect(screen.getByLabelText('Commande validée — par WhatsApp').checked).toBe(true)
    expect(screen.getByLabelText('Nouveau message — par WhatsApp').checked).toBe(false)
    expect(screen.getByLabelText('Nouveau message — par e-mail').checked).toBe(false)
  })

  it('enregistre le choix WhatsApp par événement', async () => {
    vi.mocked(fetchNotificationPreferences).mockResolvedValue(on())
    vi.mocked(updateNotificationPreferences).mockResolvedValue(on())
    show()
    fireEvent.click(await screen.findByLabelText('Nouveau message — par WhatsApp'))
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les préférences' }))
    await waitFor(() => expect(updateNotificationPreferences).toHaveBeenCalled())
    expect(vi.mocked(updateNotificationPreferences).mock.calls[0][0]).toContainEqual({ event_type: 'message_received', channel: 'whatsapp', enabled: true })
  })

  it('désactive WhatsApp et retire la colonne', async () => {
    vi.mocked(fetchNotificationPreferences).mockResolvedValue(on())
    vi.mocked(setWhatsAppConsent).mockResolvedValue({ ...off(), message: 'Notifications WhatsApp désactivées.' })
    show()
    fireEvent.click(await screen.findByRole('button', { name: 'Désactiver' }))
    expect(await screen.findByText('Notifications WhatsApp désactivées.')).toBeTruthy()
    expect(screen.queryByLabelText('Nouveau message — par WhatsApp')).toBeNull()
  })

  it('demande un numéro quand le compte n’en a pas de valide', async () => {
    vi.mocked(fetchNotificationPreferences).mockResolvedValue(off({ phone: null }))
    show()
    expect((await screen.findByRole('link', { name: 'Ajouter mon numéro' })).getAttribute('href')).toBe('/parametres')
    expect(screen.queryByRole('button', { name: "J'accepte et j'active" })).toBeNull()
  })

  it('affiche le refus de l’API', async () => {
    vi.mocked(fetchNotificationPreferences).mockResolvedValue(off())
    vi.mocked(setWhatsAppConsent).mockRejectedValue(Object.assign(new Error(), { fieldErrors: { enabled: ["WhatsApp n'est pas disponible pour le moment."] } }))
    show()
    fireEvent.click(await screen.findByRole('button', { name: "J'accepte et j'active" }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/pas disponible/)
  })

  it('distingue simulé, échec replié sur l’e-mail et envoyé', async () => {
    const at = '2026-11-25T10:00:00+01:00'
    vi.mocked(fetchNotificationPreferences).mockResolvedValue(
      on({
        recent: [
          { id: 3, event: 'Commande validée', status: 'simulé', email_fallback: false, created_at: at },
          { id: 2, event: 'Décision de litige', status: 'échoué', email_fallback: true, created_at: at },
        ],
      }),
    )
    show()
    expect(await screen.findByText('Simulé, non envoyé')).toBeTruthy()
    expect(screen.queryByText('Envoyé')).toBeNull()
    expect(screen.getByText(/e-mail envoyé à la place/)).toBeTruthy()
  })

  it('service désactivé : masqué, sauf pour retirer un consentement', async () => {
    vi.mocked(fetchNotificationPreferences).mockResolvedValueOnce(off({ available: false, simulated: false }))
    show()
    await screen.findByRole('table')
    expect(screen.queryByRole('region', { name: 'WhatsApp' })).toBeNull()
    cleanup()

    vi.mocked(fetchNotificationPreferences).mockResolvedValueOnce(off({ available: false, simulated: false, opted_in: true }))
    show()
    expect(await screen.findByRole('button', { name: 'Désactiver' })).toBeTruthy()
  })
})
