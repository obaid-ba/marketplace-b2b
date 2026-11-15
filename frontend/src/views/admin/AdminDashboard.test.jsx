import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  approveSupplier,
  fetchAdminSuppliers,
  openAdminDocument,
  rejectSupplier,
} from '@/api/adminSuppliers'
import { useAuthStore } from '@/stores/auth'
import AdminDashboard from './AdminDashboard'

vi.mock('@/api/adminSuppliers', () => ({
  fetchAdminSuppliers: vi.fn(),
  approveSupplier: vi.fn(),
  rejectSupplier: vi.fn(),
  openAdminDocument: vi.fn(),
}))

function mockSupplier(overrides = {}) {
  return {
    id: 1,
    company_name: 'Acme SARL',
    validation_status: 'en attente',
    created_at: '2026-11-13T10:00:00+01:00',
    rejection_reason: null,
    user: {
      name: 'Ali Ben Salah',
      email: 'ali@acme.test',
      phone: '+216 71 123 456',
    },
    documents: [
      {
        id: 10,
        type: 'registre de commerce',
        file_name: 'Registre de commerce.pdf',
        status: 'en attente',
      },
    ],
    ...overrides,
  }
}

describe('AdminDashboard (SCRUM-31)', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: { id: 99, name: 'Admin Principal', role: 'admin' },
      token: 'admin-token',
      loaded: true,
    })
    vi.mocked(fetchAdminSuppliers).mockResolvedValue({
      data: [mockSupplier()],
      current_page: 1,
      last_page: 1,
      total: 1,
    })
    vi.mocked(approveSupplier).mockResolvedValue({
      message: 'Le dossier fournisseur a été validé avec succès.',
    })
    vi.mocked(rejectSupplier).mockResolvedValue({
      message: 'Le dossier fournisseur a été refusé.',
    })
    vi.mocked(openAdminDocument).mockResolvedValue()
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('affiche la file des demandes avec le fournisseur et ses documents', async () => {
    render(<AdminDashboard />)

    expect(screen.getByText('Chargement des dossiers fournisseurs...')).toBeTruthy()

    await waitFor(() => {
      expect(screen.getByText('Acme SARL')).toBeTruthy()
      expect(screen.getByText('Ali Ben Salah')).toBeTruthy()
      expect(screen.getByText('Registre de commerce')).toBeTruthy()
    })

    expect(fetchAdminSuppliers).toHaveBeenCalledWith('en attente', 1)
  })

  it('permet de changer d’onglet pour filtrer par statut', async () => {
    render(<AdminDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Acme SARL')).toBeTruthy()
    })

    const validatedTab = screen.getByRole('button', { name: 'Validés' })
    fireEvent.click(validatedTab)

    await waitFor(() => {
      expect(fetchAdminSuppliers).toHaveBeenCalledWith('validé', 1)
    })
  })

  it('permet d’accepter un dossier en un clic', async () => {
    render(<AdminDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Acme SARL')).toBeTruthy()
    })

    const approveBtn = screen.getByRole('button', { name: 'Accepter le dossier' })
    fireEvent.click(approveBtn)

    await waitFor(() => {
      expect(approveSupplier).toHaveBeenCalledWith(1)
    })
  })

  it('ouvre une modale de refus et exige un motif avant envoi', async () => {
    render(<AdminDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Acme SARL')).toBeTruthy()
    })

    const rejectBtn = screen.getByRole('button', { name: 'Refuser le dossier' })
    fireEvent.click(rejectBtn)

    // La modale s'affiche
    expect(screen.getByText(/Refuser le dossier de « Acme SARL »/)).toBeTruthy()

    const confirmBtn = screen.getByRole('button', { name: 'Confirmer le refus' })
    // Le bouton est initialement désactivé car aucun motif n'est saisi
    expect(confirmBtn.disabled).toBe(true)

    const textarea = screen.getByLabelText(/Motif du refus/)
    fireEvent.change(textarea, { target: { value: 'Registre non conforme' } })

    expect(confirmBtn.disabled).toBe(false)
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(rejectSupplier).toHaveBeenCalledWith(1, 'Registre non conforme')
    })
  })

  it('permet de consulter / télécharger un justificatif', async () => {
    render(<AdminDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Acme SARL')).toBeTruthy()
    })

    const downloadBtn = screen.getByRole('button', { name: 'Consulter / Télécharger' })
    fireEvent.click(downloadBtn)

    expect(openAdminDocument).toHaveBeenCalledWith(expect.objectContaining({ id: 10 }))
  })
})
