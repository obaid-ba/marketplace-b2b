import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createBuyerDispute, fetchBuyerDisputes } from '@/api/disputes'
import BuyerDisputesPage from './BuyerDisputesPage'

vi.mock('@/api/disputes', () => ({
  fetchAdminDisputes: vi.fn(),
  assignDispute: vi.fn(),
  decideDispute: vi.fn(),
  fetchBuyerDisputes: vi.fn(),
  createBuyerDispute: vi.fn(),
  fetchSupplierDisputes: vi.fn(),
}))

const emptyPage = { data: [], current_page: 1, last_page: 1, total: 0 }

beforeEach(() => {
  fetchBuyerDisputes.mockResolvedValue(emptyPage)
  createBuyerDispute.mockResolvedValue({
    message: "Votre litige a été ouvert. L'administration et le fournisseur ont été informés.",
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('BuyerDisputesPage (SCRUM-67)', () => {
  it('ouvre un litige sur une commande', async () => {
    render(<BuyerDisputesPage />)
    await screen.findByText("Vous n'avez ouvert aucun litige.")

    fireEvent.change(screen.getByLabelText('Numéro de commande'), { target: { value: '42' } })
    fireEvent.change(screen.getByLabelText('Motif'), { target: { value: 'Produit endommagé' } })
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Deux cartons sur dix sont arrivés écrasés.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Ouvrir le litige' }))

    await waitFor(() =>
      expect(createBuyerDispute).toHaveBeenCalledWith(42, {
        reason: 'Produit endommagé',
        description: 'Deux cartons sur dix sont arrivés écrasés.',
        attachments: [],
      }),
    )
    expect((await screen.findByRole('status')).textContent).toContain('Votre litige a été ouvert')
  })

  it('affiche les litiges existants et leur décision', async () => {
    fetchBuyerDisputes.mockResolvedValue({
      data: [
        {
          id: 8,
          status: 'décidé',
          reason: 'Produit manquant',
          description: 'Un carton manquait à la livraison.',
          created_at: '2027-01-10T10:00:00.000000Z',
          order: { id: 5, total: '500.00', supplier: { company_name: 'Atlas' } },
          assigned_admin: { name: 'Nadia' },
          decision: 'Remboursement partiel',
          decision_note: 'Preuves fournies.',
          attachments: [],
        },
      ],
      current_page: 1,
      last_page: 1,
      total: 1,
    })

    render(<BuyerDisputesPage />)

    expect(await screen.findByText('Litige #8')).toBeTruthy()
    expect(screen.getByText('Produit manquant')).toBeTruthy()
    expect(screen.getByText(/Décision : Remboursement partiel — Preuves fournies\./)).toBeTruthy()
  })
})
