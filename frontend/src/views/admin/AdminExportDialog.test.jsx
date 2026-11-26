import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createExport, downloadExport, fetchExports } from '@/api/adminExports'
import AdminExportDialog from './AdminExportDialog'

vi.mock('@/api/adminExports', () => ({
  fetchExports: vi.fn(),
  createExport: vi.fn(),
  downloadExport: vi.fn(),
}))

const range = { from: '2027-01-01', to: '2027-01-31' }
const invertedRange = { from: '2027-02-01', to: '2027-01-01' }

const readyExport = {
  id: 7,
  format: 'csv',
  period_from: '2027-01-01T00:00:00.000000Z',
  period_to: '2027-01-31T00:00:00.000000Z',
  status: 'prêt',
}

beforeEach(() => {
  fetchExports.mockResolvedValue({ data: [readyExport] })
  createExport.mockResolvedValue({ message: 'Votre export est en préparation.' })
  downloadExport.mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('AdminExportDialog (SCRUM-75)', () => {
  it('lance un export CSV puis permet de télécharger un export prêt', async () => {
    render(<AdminExportDialog open defaultRange={range} onClose={() => {}} />)

    expect(screen.getByRole('dialog', { name: 'Exporter les statistiques' })).toBeTruthy()
    expect(await screen.findByText(/Export #7/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Lancer l’export' }))

    await waitFor(() =>
      expect(createExport).toHaveBeenCalledWith({
        from: '2027-01-01',
        to: '2027-01-31',
        format: 'csv',
        indicators: ['signups', 'orders', 'revenue', 'tenders', 'categories'],
      }),
    )
    expect((await screen.findByRole('status')).textContent).toContain('Votre export est en préparation.')

    fireEvent.click(await screen.findByRole('button', { name: 'Télécharger' }))
    await waitFor(() => expect(downloadExport).toHaveBeenCalledWith(7, 'csv'))
  })

  it('exporte en Excel les indicateurs choisis, au moins un', async () => {
    render(<AdminExportDialog open defaultRange={range} onClose={() => {}} />)
    await screen.findByText(/Export #7/)
    fireEvent.change(screen.getByLabelText('Format'), { target: { value: 'xlsx' } })
    ;['Inscriptions', 'Commandes', "Chiffre d'affaires", 'Demandes', 'Catégories'].forEach((label) => fireEvent.click(screen.getByLabelText(label)))
    fireEvent.click(screen.getByRole('button', { name: 'Lancer l’export' }))
    expect((await screen.findByRole('alert')).textContent).toContain('au moins un indicateur')

    fireEvent.click(screen.getByLabelText('Demandes'))
    fireEvent.click(screen.getByLabelText('Inscriptions'))
    fireEvent.click(screen.getByRole('button', { name: 'Lancer l’export' }))
    await waitFor(() => expect(createExport).toHaveBeenCalledWith(expect.objectContaining({ format: 'xlsx', indicators: ['signups', 'tenders'] })))
  })

  it('rafraîchit la liste tant qu’un export est en préparation', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    fetchExports.mockResolvedValueOnce({ data: [{ ...readyExport, status: 'en attente' }] })
    render(<AdminExportDialog open defaultRange={range} onClose={() => {}} />)
    expect(await screen.findByText('En attente')).toBeTruthy()
    await vi.advanceTimersByTimeAsync(3100)
    expect(await screen.findByRole('button', { name: 'Télécharger' })).toBeTruthy()
    vi.useRealTimers()
  })

  it('refuse une période inversée sans appeler l’API', async () => {
    render(<AdminExportDialog open defaultRange={invertedRange} onClose={() => {}} />)
    await screen.findByText(/Export #7/)

    fireEvent.click(screen.getByRole('button', { name: 'Lancer l’export' }))

    expect((await screen.findByRole('alert')).textContent).toContain(
      'La date de début doit précéder la date de fin.',
    )
    expect(createExport).not.toHaveBeenCalled()
  })
})
