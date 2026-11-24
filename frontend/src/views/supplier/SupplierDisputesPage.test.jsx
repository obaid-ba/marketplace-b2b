import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { fetchSupplierDisputes } from '@/api/disputes'
import SupplierDisputesPage from './SupplierDisputesPage'

vi.mock('@/api/disputes', () => ({
  fetchAdminDisputes: vi.fn(),
  assignDispute: vi.fn(),
  decideDispute: vi.fn(),
  fetchBuyerDisputes: vi.fn(),
  createBuyerDispute: vi.fn(),
  fetchSupplierDisputes: vi.fn(),
}))

beforeEach(() => {
  fetchSupplierDisputes.mockResolvedValue({
    data: [
      {
        id: 4,
        status: 'en cours',
        reason: 'Produit endommagé',
        description: 'Deux cartons écrasés.',
        created_at: '2027-01-10T10:00:00.000000Z',
        order: { id: 5, total: '500.00' },
        attachments: [{ id: 1 }],
      },
    ],
    current_page: 1,
    last_page: 1,
    total: 1,
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('SupplierDisputesPage (SCRUM-67)', () => {
  it('affiche les litiges reçus en lecture seule', async () => {
    render(<SupplierDisputesPage />)

    expect(await screen.findByText('Litige #4')).toBeTruthy()
    expect(screen.getByText('Produit endommagé')).toBeTruthy()
    expect(screen.getByText('1 pièce(s) jointe(s)')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
