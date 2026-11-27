import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { fetchMyDisputes } from '@/api/disputes'
import { useAuthStore } from '@/stores/auth'
import MyDisputesPage from './MyDisputesPage'

vi.mock('@/api/disputes', () => ({ fetchMyDisputes: vi.fn(), downloadDisputeAttachment: vi.fn() }))
vi.mock('@/realtime/realtime', () => ({ useRealtime: vi.fn() }))

const dispute = {
  id: 7,
  order_id: 42,
  status: 'décidé',
  reason: 'Produit endommagé',
  decision: 'Remboursement total',
  created_at: '2026-11-20T10:00:00+01:00',
  order: { id: 42, total: 120 },
  buyer: { name: 'Atelier Amel' },
  supplier: { name: 'Atlas SARL' },
}
const list = (data) => ({ data, meta: { current_page: 1, last_page: 1 } })

function show(role) {
  useAuthStore.setState({ user: { id: 1, role, email_verified: true }, token: 't', loaded: true })
  render(
    <MemoryRouter>
      <MyDisputesPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.mocked(fetchMyDisputes).mockReset()
})
afterEach(cleanup)

describe('Mes litiges (SCRUM-67)', () => {
  it('montre au porteur le fournisseur, la décision et le lien vers le litige', async () => {
    vi.mocked(fetchMyDisputes).mockResolvedValue(list([dispute]))
    show('buyer')
    const link = await screen.findByRole('link', { name: /Commande n° 42/ })
    expect(link.getAttribute('href')).toBe('/litiges/7')
    expect(link.textContent).toMatch(/Atlas SARL.*Remboursement total/)
  })

  it('montre au fournisseur les litiges reçus', async () => {
    vi.mocked(fetchMyDisputes).mockResolvedValue(list([dispute]))
    show('supplier')
    expect(screen.getByRole('heading', { name: 'Litiges reçus' })).toBeTruthy()
    expect((await screen.findByRole('link', { name: /Commande n° 42/ })).textContent).toMatch(/Atelier Amel/)
  })

  it('sans litige, renvoie le porteur vers ses commandes', async () => {
    vi.mocked(fetchMyDisputes).mockResolvedValue(list([]))
    show('buyer')
    expect((await screen.findByRole('link', { name: 'Mes commandes' })).getAttribute('href')).toBe('/porteur/commandes')
  })

  it('permet de réessayer après une erreur', async () => {
    vi.mocked(fetchMyDisputes).mockRejectedValueOnce(new Error()).mockResolvedValueOnce(list([dispute]))
    show('buyer')
    fireEvent.click(await screen.findByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByRole('link', { name: /Commande n° 42/ })).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
