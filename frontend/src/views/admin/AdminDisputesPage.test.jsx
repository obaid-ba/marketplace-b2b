import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { assignDispute, decideDispute, fetchAdminDisputes } from '@/api/disputes'
import AdminDisputesPage from './AdminDisputesPage'

vi.mock('@/api/disputes', () => ({
  fetchAdminDisputes: vi.fn(),
  assignDispute: vi.fn(),
  decideDispute: vi.fn(),
  fetchBuyerDisputes: vi.fn(),
  createBuyerDispute: vi.fn(),
  fetchSupplierDisputes: vi.fn(),
}))

const page = {
  data: [
    {
      id: 1,
      status: 'ouvert',
      reason: 'Produit endommagé',
      description: 'Deux cartons sur dix sont arrivés écrasés.',
      created_at: '2027-01-10T10:00:00.000000Z',
      opener: { name: 'Karim Ben Salah' },
      order: { id: 5, total: '500.00', supplier: { company_name: 'Atlas' } },
      assigned_admin: null,
      attachments: [],
    },
  ],
  current_page: 1,
  last_page: 1,
  total: 1,
}

beforeEach(() => {
  fetchAdminDisputes.mockResolvedValue(page)
  assignDispute.mockResolvedValue({ message: 'Le litige est désormais en cours et vous a été assigné.' })
  decideDispute.mockResolvedValue({ message: 'La décision a été enregistrée et les deux parties ont été notifiées.' })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('AdminDisputesPage (SCRUM-73)', () => {
  it('affiche le litige et le prend en charge', async () => {
    render(<AdminDisputesPage />)

    expect(await screen.findByText('Litige #1')).toBeTruthy()
    expect(screen.getByText('Produit endommagé')).toBeTruthy()
    expect(screen.getByText(/Ouvert par Karim Ben Salah/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Prendre en charge' }))

    await waitFor(() => expect(assignDispute).toHaveBeenCalledWith(1))
    expect((await screen.findByRole('status')).textContent).toContain('en cours')
  })

  it('rend une décision motivée', async () => {
    render(<AdminDisputesPage />)
    await screen.findByText('Litige #1')

    fireEvent.click(screen.getByRole('button', { name: 'Rendre une décision' }))
    expect(screen.getByRole('dialog', { name: 'Décision du litige #1' })).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Décision'), {
      target: { value: 'Remboursement partiel' },
    })
    fireEvent.change(screen.getByLabelText('Note motivée'), {
      target: { value: 'Deux cartons endommagés confirmés par les photos.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer la décision' }))

    await waitFor(() =>
      expect(decideDispute).toHaveBeenCalledWith(1, {
        decision: 'Remboursement partiel',
        note: 'Deux cartons endommagés confirmés par les photos.',
      }),
    )
  })
})
