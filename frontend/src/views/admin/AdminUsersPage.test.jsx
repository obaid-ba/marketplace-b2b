import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { deleteUser, fetchAdminUsers, reactivateUser, suspendUser } from '@/api/adminUsers'
import AdminUsersPage from './AdminUsersPage'

vi.mock('@/api/adminUsers', () => ({
  fetchAdminUsers: vi.fn(),
  suspendUser: vi.fn(),
  reactivateUser: vi.fn(),
  deleteUser: vi.fn(),
}))

const page = {
  data: [
    {
      id: 1,
      name: 'Karim Ben Salah',
      email: 'karim@example.test',
      role: 'buyer',
      status: 'actif',
      buyer_profile: { organization: 'Porteur SARL' },
    },
    {
      id: 2,
      name: 'Amel Atlas',
      email: 'amel@example.test',
      role: 'supplier',
      status: 'suspendu',
      supplier_profile: { company_name: 'Atlas' },
    },
  ],
  current_page: 1,
  last_page: 1,
  total: 2,
}

beforeEach(() => {
  fetchAdminUsers.mockResolvedValue(page)
  suspendUser.mockResolvedValue({ message: 'Le compte a été suspendu et ses sessions ont été fermées.' })
  reactivateUser.mockResolvedValue({ message: 'Le compte a été réactivé.' })
  deleteUser.mockResolvedValue({ message: 'Le compte a été supprimé.' })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('AdminUsersPage (SCRUM-71)', () => {
  it('liste les comptes avec rôle, statut et organisation', async () => {
    render(<AdminUsersPage />)

    expect(await screen.findByText('Karim Ben Salah')).toBeTruthy()
    expect(screen.getAllByText('Porteur de projet').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/karim@example.test · Porteur SARL/)).toBeTruthy()
    expect(screen.getByText('Amel Atlas')).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Supprimer' })).toHaveLength(2)
  })

  it('suspend un compte avec un motif obligatoire', async () => {
    render(<AdminUsersPage />)
    await screen.findByText('Karim Ben Salah')

    fireEvent.click(screen.getByRole('button', { name: 'Suspendre' }))
    const dialog = screen.getByRole('dialog', { name: 'Suspendre le compte' })
    expect(dialog).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Motif'), {
      target: { value: 'Comportement frauduleux' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Suspendre' }))

    await waitFor(() => expect(suspendUser).toHaveBeenCalledWith(1, 'Comportement frauduleux'))
  })

  it('réactive un compte suspendu', async () => {
    render(<AdminUsersPage />)
    await screen.findByText('Amel Atlas')

    fireEvent.click(screen.getByRole('button', { name: 'Réactiver' }))
    const dialog = screen.getByRole('dialog', { name: 'Réactiver le compte' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Réactiver' }))

    await waitFor(() => expect(reactivateUser).toHaveBeenCalledWith(2))
  })
})
