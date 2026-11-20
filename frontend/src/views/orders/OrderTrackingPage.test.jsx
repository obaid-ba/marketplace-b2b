import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import {
  advanceSupplierOrder,
  confirmReceiptOrder,
  fetchDocumentDownloadBlob,
  fetchOrderDetails,
  fetchOrderDocumentBlob,
} from '@/api/orders'
import { submitBuyerReview } from '@/api/reviews'
import { useAuthStore } from '@/stores/auth'
import OrderTrackingPage from './OrderTrackingPage'

vi.mock('@/api/orders', () => ({
  fetchOrderDetails: vi.fn(),
  advanceSupplierOrder: vi.fn(),
  fetchOrderDocumentBlob: vi.fn(),
  fetchDocumentDownloadBlob: vi.fn(),
  confirmReceiptOrder: vi.fn(),
}))

vi.mock('@/api/reviews', () => ({
  submitBuyerReview: vi.fn(),
}))

function mockOrder(overrides = {}) {
  return {
    id: 101,
    origin: 'catalogue',
    status: 'validée',
    total: '850.00',
    created_at: '2026-11-16T10:00:00+01:00',
    supplier: {
      id: 20,
      user_id: 10,
      company_name: 'Outillage Pro SARL',
      user: { id: 10, name: 'Karim Vendeur', email: 'karim@pro.tn', phone: '71000111' },
      city: 'Sfax',
      payment_terms: 'Comptant à la livraison',
    },
    buyer: {
      id: 30,
      user_id: 5,
      organization: 'Chantiers Modernes',
      user: { id: 5, name: 'Sami Acheteur', email: 'sami@chantiers.tn', phone: '71222333' },
      city: 'Tunis',
    },
    items: [
      {
        id: 1,
        label: 'Perceuse à percussion 800W',
        quantity: 2,
        unit_price: '425.00',
        line_total: '850.00',
      },
    ],
    status_history: [
      {
        id: 1,
        status: 'validée',
        changed_at: '2026-11-16T10:00:00+01:00',
        changer: { id: 5, name: 'Sami Acheteur' },
      },
    ],
    documents: [],
    ...overrides,
  }
}

describe('OrderTrackingPage (SCRUM-54, SCRUM-55 / F18)', () => {
  beforeEach(() => {
    vi.mocked(fetchOrderDetails).mockResolvedValue(mockOrder())
    vi.mocked(advanceSupplierOrder).mockResolvedValue({
      message: 'Statut de la commande mis à jour vers « expédiée ».',
      order: mockOrder({
        status: 'expédiée',
        status_history: [
          { id: 1, status: 'validée', changed_at: '2026-11-16T10:00:00+01:00' },
          { id: 2, status: 'expédiée', changed_at: '2026-11-16T11:00:00+01:00' },
        ],
      }),
    })
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/fake.pdf')
    globalThis.URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('affiche les détails de la commande, la timeline et les articles pour un acheteur sans bouton d’avancement', async () => {
    useAuthStore.setState({
      user: { id: 5, name: 'Sami Acheteur', role: 'buyer' },
      token: 'buyer-token',
      loaded: true,
    })

    render(
      <MemoryRouter initialEntries={['/orders/101']}>
        <Routes>
          <Route path="/orders/:id" element={<OrderTrackingPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Chargement du suivi de commande...')).toBeTruthy()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Commande #101' })).toBeTruthy()
      expect(screen.getAllByText(/850\.00/).length).toBeGreaterThan(0)
      expect(screen.getByText('Perceuse à percussion 800W')).toBeTruthy()
      expect(screen.getByText('Outillage Pro SARL')).toBeTruthy()
      expect(screen.getByText('Chantiers Modernes')).toBeTruthy()
    })

    // L'acheteur ne voit PAS le bouton d'avancement fournisseur
    expect(screen.queryByRole('button', { name: 'Marquer comme expédiée' })).toBeNull()
  })

  it('affiche le bouton « Marquer comme expédiée » pour le fournisseur et permet d’avancer le statut', async () => {
    useAuthStore.setState({
      user: { id: 10, name: 'Karim Vendeur', role: 'supplier' },
      token: 'supplier-token',
      loaded: true,
    })

    render(
      <MemoryRouter initialEntries={['/orders/101']}>
        <Routes>
          <Route path="/orders/:id" element={<OrderTrackingPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Commande #101' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Marquer comme expédiée' })).toBeTruthy()
    })

    const advanceBtn = screen.getByRole('button', { name: 'Marquer comme expédiée' })
    fireEvent.click(advanceBtn)

    await waitFor(() => {
      expect(advanceSupplierOrder).toHaveBeenCalledWith(101)
      expect(screen.getByText(/Statut de la commande mis à jour vers « expédiée »/)).toBeTruthy()
    })
  })

  it('affiche le bouton « Marquer comme livrée » lorsque le statut est expédiée', async () => {
    vi.mocked(fetchOrderDetails).mockResolvedValue(
      mockOrder({
        status: 'expédiée',
        status_history: [
          { id: 1, status: 'validée', changed_at: '2026-11-16T10:00:00+01:00' },
          { id: 2, status: 'expédiée', changed_at: '2026-11-16T11:00:00+01:00' },
        ],
      }),
    )

    useAuthStore.setState({
      user: { id: 10, name: 'Karim Vendeur', role: 'supplier' },
      token: 'supplier-token',
      loaded: true,
    })

    render(
      <MemoryRouter initialEntries={['/orders/101']}>
        <Routes>
          <Route path="/orders/:id" element={<OrderTrackingPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Marquer comme livrée' })).toBeTruthy()
    })
  })

  it('permet de télécharger un document PDF (devis ou facture) lorsqu’il est disponible', async () => {
    vi.mocked(fetchOrderDetails).mockResolvedValue(
      mockOrder({
        origin: 'devis',
        status: 'clôturée',
        documents: [
          { id: 1, type: 'devis', number: 'DEV-2026-001', pdf_path: 'devis.pdf' },
          { id: 2, type: 'facture', number: 'FAC-2026-001', pdf_path: 'facture.pdf' },
        ],
      }),
    )
    vi.mocked(fetchDocumentDownloadBlob).mockResolvedValue(new Blob(['fake pdf'], { type: 'application/pdf' }))

    useAuthStore.setState({
      user: { id: 5, name: 'Sami Acheteur', role: 'buyer' },
      token: 'buyer-token',
      loaded: true,
    })

    render(
      <MemoryRouter initialEntries={['/orders/101']}>
        <Routes>
          <Route path="/orders/:id" element={<OrderTrackingPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Télécharger le devis PDF/ })).toBeTruthy()
      expect(screen.getByRole('button', { name: /Télécharger la facture PDF/ })).toBeTruthy()
    })

    const downloadQuoteBtn = screen.getByRole('button', { name: /Télécharger le devis PDF/ })
    fireEvent.click(downloadQuoteBtn)

    await waitFor(() => {
      expect(fetchDocumentDownloadBlob).toHaveBeenCalledWith(1)
    })
  })

  it('affiche le bouton « Confirmer la réception » pour l’acheteur lorsque la commande est livrée et clôture la commande (SCRUM-56)', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    vi.mocked(fetchOrderDetails).mockResolvedValue(
      mockOrder({
        status: 'livrée',
        status_history: [
          { id: 1, status: 'validée', changed_at: '2026-11-16T10:00:00+01:00' },
          { id: 2, status: 'expédiée', changed_at: '2026-11-16T11:00:00+01:00' },
          { id: 3, status: 'livrée', changed_at: '2026-11-16T14:00:00+01:00' },
        ],
      }),
    )

    vi.mocked(confirmReceiptOrder).mockResolvedValue({
      message: 'Réception confirmée avec succès. La commande est désormais clôturée.',
      order: mockOrder({
        status: 'clôturée',
        documents: [
          { id: 12, type: 'facture', number: 'FAC-2026-00001', pdf_path: 'documents/orders/101/FAC-2026-00001.pdf' },
        ],
        status_history: [
          { id: 1, status: 'validée', changed_at: '2026-11-16T10:00:00+01:00' },
          { id: 2, status: 'expédiée', changed_at: '2026-11-16T11:00:00+01:00' },
          { id: 3, status: 'livrée', changed_at: '2026-11-16T14:00:00+01:00' },
          { id: 4, status: 'clôturée', changed_at: '2026-11-16T15:00:00+01:00' },
        ],
      }),
    })

    useAuthStore.setState({
      user: { id: 5, name: 'Sami Acheteur', role: 'buyer' },
      token: 'buyer-token',
      loaded: true,
    })

    render(
      <MemoryRouter initialEntries={['/orders/101']}>
        <Routes>
          <Route path="/orders/:id" element={<OrderTrackingPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Confirmer la réception' })).toBeTruthy()
    })

    const confirmBtn = screen.getByRole('button', { name: 'Confirmer la réception' })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(confirmReceiptOrder).toHaveBeenCalledWith(101)
      expect(screen.getByText(/Réception confirmée avec succès/)).toBeTruthy()
      expect(screen.getByRole('button', { name: /Télécharger la facture PDF/ })).toBeTruthy()
    })
  })

  it('affiche l’invitation à laisser un avis quand la commande est clôturée sans avis (SCRUM-56, SCRUM-114)', async () => {
    vi.mocked(fetchOrderDetails).mockResolvedValue(
      mockOrder({
        status: 'clôturée',
        review: null,
      }),
    )

    useAuthStore.setState({
      user: { id: 5, name: 'Sami Acheteur', role: 'buyer' },
      token: 'buyer-token',
      loaded: true,
    })

    render(
      <MemoryRouter initialEntries={['/orders/101']}>
        <Routes>
          <Route path="/orders/:id" element={<OrderTrackingPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(
        screen.getByText(/Votre commande est clôturée — Laissez un avis sur ce fournisseur/),
      ).toBeTruthy()
      expect(screen.getByRole('button', { name: /Laisser un avis/ })).toBeTruthy()
    })
  })

  it('permet à l’acheteur d’ouvrir le formulaire et de publier son avis (SCRUM-64)', async () => {
    vi.mocked(fetchOrderDetails).mockResolvedValue(
      mockOrder({
        status: 'clôturée',
        review: null,
      }),
    )

    vi.mocked(submitBuyerReview).mockResolvedValue({
      message: 'Votre avis a été enregistré avec succès.',
      review: {
        id: 1,
        rating: 5,
        comment: 'Livraison impeccable et matériel d’excellente facture.',
        supplier_reply: null,
      },
    })

    useAuthStore.setState({
      user: { id: 5, name: 'Sami Acheteur', role: 'buyer' },
      token: 'buyer-token',
      loaded: true,
    })

    render(
      <MemoryRouter initialEntries={['/orders/101']}>
        <Routes>
          <Route path="/orders/:id" element={<OrderTrackingPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Laisser un avis/ })).toBeTruthy()
    })

    // Ouverture du formulaire
    fireEvent.click(screen.getByRole('button', { name: /Laisser un avis/ }))

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Conformité des produits/)).toBeTruthy()
    })

    const commentInput = screen.getByPlaceholderText(/Conformité des produits/)
    fireEvent.change(commentInput, {
      target: { value: 'Livraison impeccable et matériel d’excellente facture.' },
    })

    const submitBtn = screen.getByRole('button', { name: 'Publier mon avis' })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(submitBuyerReview).toHaveBeenCalledWith(101, {
        rating: 5,
        comment: 'Livraison impeccable et matériel d’excellente facture.',
      })
      expect(screen.getByText(/Votre avis a été enregistré avec succès/)).toBeTruthy()
      expect(screen.getByText(/Livraison impeccable et matériel d’excellente facture\./)).toBeTruthy()
    })
  })
})
