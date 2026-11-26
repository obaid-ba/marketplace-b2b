import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { fetchAdminProducts, withdrawProduct } from '@/api/adminModeration'
import AdminProductsPage from './AdminProductsPage'

vi.mock('@/api/adminModeration', () => ({
  fetchAdminProducts: vi.fn(),
  withdrawProduct: vi.fn(),
  fetchReportedReviews: vi.fn(),
  keepReview: vi.fn(),
  hideReview: vi.fn(),
}))

const page = {
  data: [
    {
      id: 1,
      title: 'Carton double cannelure',
      status: 'publié',
      price: '12.50',
      supplier: { company_name: 'Atlas' },
      category: { name: 'Emballage' },
    },
    {
      id: 2,
      title: 'Palette bois',
      status: 'retiré',
      price: '30.00',
      supplier: { company_name: 'Atlas' },
      category: { name: 'Emballage' },
      withdrawal_reason: 'Photo non conforme',
    },
  ],
  current_page: 1,
  last_page: 1,
  total: 2,
}

beforeEach(() => {
  fetchAdminProducts.mockResolvedValue(page)
  withdrawProduct.mockResolvedValue({ message: 'Le produit a été retiré du catalogue et le fournisseur a été notifié.' })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('AdminProductsPage (SCRUM-72)', () => {
  it('liste le catalogue avec les statuts et les motifs de retrait', async () => {
    render(<AdminProductsPage />)

    expect(await screen.findByText('Carton double cannelure')).toBeTruthy()
    expect(screen.getByText('Palette bois')).toBeTruthy()
    expect(screen.getByText('Motif de retrait : Photo non conforme')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Retirer du catalogue' })).toHaveLength(1)
  })

  it('retire un produit avec un motif et recharge la liste', async () => {
    render(<AdminProductsPage />)
    await screen.findByText('Carton double cannelure')

    fireEvent.click(screen.getByRole('button', { name: 'Retirer du catalogue' }))
    expect(screen.getByRole('dialog', { name: 'Retirer « Carton double cannelure »' })).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Motif du retrait'), {
      target: { value: 'Allégations non vérifiables' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer le retrait' }))

    await waitFor(() => expect(withdrawProduct).toHaveBeenCalledWith(1, 'Allégations non vérifiables'))
    await waitFor(() => expect(fetchAdminProducts).toHaveBeenCalledTimes(2))
    expect((await screen.findByRole('status')).textContent).toContain('Le produit a été retiré')
  })
})
