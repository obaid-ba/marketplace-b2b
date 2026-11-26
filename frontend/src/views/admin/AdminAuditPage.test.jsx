import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { fetchAuditLogs } from '@/api/auditLogs'
import AdminAuditPage from './AdminAuditPage'

vi.mock('@/api/auditLogs', () => ({ fetchAuditLogs: vi.fn() }))

const page = (data) => ({ data, meta: { current_page: 1, last_page: 1 }, actions: ['user.suspended', 'x.inconnue'], admins: [{ id: 3, name: 'Sonia' }] })
const entry = { id: 1, action: 'user.suspended', target: 'user:7', reason: 'Fraude', created_at: '2026-11-25T10:00:00+00:00', admin: { id: 3, name: 'Sonia' } }

const show = (url = '/admin/journal') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <AdminAuditPage />
    </MemoryRouter>,
  )

beforeEach(() => {
  vi.mocked(fetchAuditLogs).mockReset()
  vi.mocked(fetchAuditLogs).mockResolvedValue(page([entry]))
})
afterEach(cleanup)

describe('Journal d’audit (SCRUM-76)', () => {
  it('affiche l’action, la cible, le motif, l’admin et la date, sans bouton de modification', async () => {
    show()
    expect((await screen.findByRole('link', { name: 'Utilisateur n° 7' })).getAttribute('href')).toBe('/admin/utilisateurs/7')
    expect(screen.getAllByText('Compte suspendu').length).toBe(2) // entrée + option du filtre
    expect(screen.getByText('Fraude')).toBeTruthy()
    expect(screen.getByText(/25\/11\/2026.*11:00.*Sonia/)).toBeTruthy()
    expect(screen.queryAllByRole('button').filter((button) => /supprimer|modifier/i.test(button.textContent))).toHaveLength(0)
  })

  it('filtre et revient à la première page', async () => {
    show('/admin/journal?page=2')
    await screen.findByText('Fraude')
    expect(fetchAuditLogs).toHaveBeenCalledWith({ page: 2 })
    fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'user.suspended' } })
    fireEvent.change(screen.getByLabelText('Cible'), { target: { value: 'user:' } })
    fireEvent.change(screen.getByLabelText('Administrateur'), { target: { value: '3' } })
    await waitFor(() => expect(fetchAuditLogs).toHaveBeenLastCalledWith({ page: 1, action: 'user.suspended', target: 'user:', admin_id: '3' }))
  })

  it('supporte un administrateur supprimé, une liste vide et une erreur', async () => {
    vi.mocked(fetchAuditLogs).mockResolvedValueOnce(page([{ ...entry, admin: null }]))
    show()
    expect(await screen.findByText(/Administrateur supprimé/)).toBeTruthy()
    cleanup()
    vi.mocked(fetchAuditLogs).mockResolvedValueOnce(page([]))
    show()
    expect(await screen.findByText('Aucune action')).toBeTruthy()
    cleanup()
    vi.mocked(fetchAuditLogs).mockRejectedValueOnce(new Error())
    show()
    expect(await screen.findByRole('alert')).toBeTruthy()
  })
})
