import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { fetchSupplierReviews, replyToSupplierReview, reportReview } from '@/api/reviews'
import SupplierReviewsPage from './SupplierReviewsPage'

vi.mock('@/api/reviews', () => ({
  fetchSupplierReviews: vi.fn(),
  replyToSupplierReview: vi.fn(),
  reportReview: vi.fn(),
}))

function mockReviewsResponse(overrides = {}) {
  return {
    rating_avg: 4.5,
    reviews_count: 2,
    star_distribution: { 5: 1, 4: 1, 3: 0, 2: 0, 1: 0 },
    reviews: {
      data: [
        {
          id: 1,
          rating: 5,
          comment: 'Matériel de grande qualité et livraison ponctuelle.',
          supplier_reply: null,
          created_at: '2026-11-17T10:00:00+01:00',
          buyer: {
            id: 10,
            organization: 'BatiPro Tunisie',
            user: { id: 3, name: 'Hedi Acheteur' },
          },
          order: { id: 101, created_at: '2026-11-15T09:00:00+01:00', total: '450.00' },
        },
        {
          id: 2,
          rating: 4,
          comment: 'Conforme aux attentes.',
          supplier_reply: 'Merci beaucoup pour votre confiance !',
          created_at: '2026-11-16T14:00:00+01:00',
          buyer: {
            id: 11,
            organization: 'Chantiers du Nord',
            user: { id: 4, name: 'Sonia Acheteur' },
          },
          order: { id: 102, created_at: '2026-11-14T08:00:00+01:00', total: '250.00' },
        },
      ],
      current_page: 1,
      last_page: 1,
      total: 2,
    },
    ...overrides,
  }
}

describe('SupplierReviewsPage (SCRUM-65 / F20)', () => {
  beforeEach(() => {
    vi.mocked(fetchSupplierReviews).mockResolvedValue(mockReviewsResponse())
    vi.mocked(replyToSupplierReview).mockResolvedValue({
      message: 'Votre réponse a été enregistrée.',
      review: {
        id: 1,
        supplier_reply: 'Merci Hedi, ravi que le matériel vous convienne !',
      },
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('affiche la note moyenne, la répartition des évaluations et la liste des avis', async () => {
    render(
      <MemoryRouter>
        <SupplierReviewsPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('Chargement de vos avis clients...')).toBeTruthy()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Mes avis clients' })).toBeTruthy()
      expect(screen.getByText('4.5')).toBeTruthy()
      expect(screen.getByText('Basée sur 2 avis clients')).toBeTruthy()
      expect(screen.getByText('BatiPro Tunisie')).toBeTruthy()
      expect(screen.getByText(/Matériel de grande qualité/)).toBeTruthy()
      expect(screen.getByText('Chantiers du Nord')).toBeTruthy()
      expect(screen.getByText(/Merci beaucoup pour votre confiance !/)).toBeTruthy()
    })
  })

  it('permet au fournisseur de répondre à un avis non répondu', async () => {
    render(
      <MemoryRouter>
        <SupplierReviewsPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Répondre à cet avis/ })).toBeTruthy()
    })

    // Clic pour ouvrir le formulaire de réponse
    fireEvent.click(screen.getByRole('button', { name: /Répondre à cet avis/ }))

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Remerciez l'acheteur/)).toBeTruthy()
    })

    const textarea = screen.getByPlaceholderText(/Remerciez l'acheteur/)
    fireEvent.change(textarea, { target: { value: 'Merci Hedi, ravi que le matériel vous convienne !' } })

    const submitBtn = screen.getByRole('button', { name: 'Publier ma réponse' })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(replyToSupplierReview).toHaveBeenCalledWith(1, 'Merci Hedi, ravi que le matériel vous convienne !')
      expect(screen.getByText(/Votre réponse a été publiée avec succès/)).toBeTruthy()
      expect(screen.getByText(/Merci Hedi, ravi que le matériel vous convienne !/)).toBeTruthy()
    })
  })

  it('signale un avis abusif : motif obligatoire, puis avis en attente de décision (SCRUM-66)', async () => {
    const message = "Avis signalé. L'administrateur va l'examiner ; l'avis reste visible jusqu'à sa décision."
    vi.mocked(reportReview).mockResolvedValue({ message, report: { id: 1, reason: 'autre', status: 'en attente' } })
    render(
      <MemoryRouter>
        <SupplierReviewsPage />
      </MemoryRouter>,
    )

    fireEvent.click((await screen.findAllByRole('button', { name: /Signaler cet avis/ }))[0])
    const send = screen.getByRole('button', { name: 'Envoyer le signalement' })
    expect(send.disabled).toBe(true)

    // « Autre motif » exige des précisions
    fireEvent.click(screen.getByLabelText('Autre motif'))
    expect(send.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(/Précisions/), { target: { value: ' Chantage ' } })
    fireEvent.click(send)

    expect(await screen.findByText(/en attente de décision/)).toBeTruthy()
    expect(reportReview).toHaveBeenCalledWith(1, { reason: 'autre', details: 'Chantage' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getAllByRole('button', { name: /Signaler cet avis/ })).toHaveLength(1)
  })

  it('affiche un état vide si aucun avis n’a été reçu', async () => {
    vi.mocked(fetchSupplierReviews).mockResolvedValue(
      mockReviewsResponse({
        rating_avg: 0,
        reviews_count: 0,
        star_distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        reviews: { data: [], current_page: 1, last_page: 1, total: 0 },
      }),
    )

    render(
      <MemoryRouter>
        <SupplierReviewsPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Aucun avis reçu pour le moment')).toBeTruthy()
    })
  })
})
