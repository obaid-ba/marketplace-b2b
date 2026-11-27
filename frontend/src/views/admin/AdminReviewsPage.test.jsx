import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { fetchReportedReviews, hideReview, keepReview } from '@/api/adminModeration'
import AdminReviewsPage from './AdminReviewsPage'

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
      id: 3,
      rating: 1,
      comment: 'Propos injurieux',
      status: 'signalé',
      created_at: '2027-01-10T10:00:00.000000Z',
      buyer: { user: { name: 'Karim Ben Salah' } },
      supplier: { company_name: 'Atlas' },
      order: { id: 5 },
      reports: [{ id: 1, reason: 'Propos injurieux', author: { name: 'Atlas' } }],
    },
  ],
  current_page: 1,
  last_page: 1,
  total: 1,
}

beforeEach(() => {
  fetchReportedReviews.mockResolvedValue(page)
  keepReview.mockResolvedValue({ message: "L'avis a été conservé et reste publié." })
  hideReview.mockResolvedValue({ message: "L'avis a été masqué et la note du fournisseur recalculée." })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('AdminReviewsPage (SCRUM-74)', () => {
  it('affiche le signalement et conserve l’avis', async () => {
    render(<AdminReviewsPage />)

    expect(await screen.findByText('« Propos injurieux »')).toBeTruthy()
    expect(screen.getByText(/Signalement : Propos injurieux/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Conserver' }))

    await waitFor(() => expect(keepReview).toHaveBeenCalledWith(3))
    expect((await screen.findByRole('status')).textContent).toContain("L'avis a été conservé")
  })

  it('masque un avis avec un motif', async () => {
    render(<AdminReviewsPage />)
    await screen.findByText('« Propos injurieux »')

    fireEvent.click(screen.getByRole('button', { name: 'Masquer' }))
    expect(screen.getByRole('dialog', { name: 'Masquer cet avis' })).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Motif (facultatif)'), {
      target: { value: 'Propos injurieux' },
    })
    fireEvent.click(screen.getByRole('button', { name: "Masquer l'avis" }))

    await waitFor(() => expect(hideReview).toHaveBeenCalledWith(3, 'Propos injurieux'))
  })
})
