import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { decideAnomaly, fetchAnomalies, scanAnomalies } from '@/api/adminAnomalies'
import AnomalyAlertsCard from './AnomalyAlertsCard'

vi.mock('@/api/http', () => ({ http: { get: vi.fn(), post: vi.fn() }, onAuthError: vi.fn() }))
vi.mock('@/api/adminAnomalies', () => ({ fetchAnomalies: vi.fn(), scanAnomalies: vi.fn(), decideAnomaly: vi.fn() }))

const ALERT = {
  id: 4,
  target_type: 'compte',
  target_id: 9,
  target_label: 'Karim Test (karim@test.tn)',
  anomaly_type: 'pic de commandes',
  score: 75,
  status: 'nouvelle',
  created_at: '2027-01-24T10:00:00+01:00',
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('AnomalyAlertsCard (SCRUM-86)', () => {
  it('liste les alertes avec leur score et leur cible', () => {
    render(<AnomalyAlertsCard initialAlerts={[ALERT]} />)

    expect(screen.getByText('Score 75')).toBeTruthy()
    expect(screen.getByText('pic de commandes')).toBeTruthy()
    expect(screen.getByText(/Karim Test \(karim@test\.tn\)/)).toBeTruthy()
  })

  it('marque une alerte comme traitée', async () => {
    decideAnomaly.mockResolvedValue({ message: 'Alerte marquée comme traitée.' })
    render(<AnomalyAlertsCard initialAlerts={[ALERT]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Marquer « pic de commandes » comme traitée' }))

    expect(await screen.findByText('Alerte marquée comme traitée.')).toBeTruthy()
    expect(decideAnomaly).toHaveBeenCalledWith(4, 'handle')
    expect(screen.getByText("Aucune alerte d'anomalie")).toBeTruthy()
  })

  it('ignore une alerte', async () => {
    decideAnomaly.mockResolvedValue({ message: 'Alerte ignorée.' })
    render(<AnomalyAlertsCard initialAlerts={[ALERT]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Ignorer « pic de commandes »' }))

    await waitFor(() => expect(decideAnomaly).toHaveBeenCalledWith(4, 'ignore'))
  })

  it('lance une analyse à la demande puis recharge la liste', async () => {
    scanAnomalies.mockResolvedValue({ message: '1 alerte(s) créée(s) ou mise(s) à jour.', count: 1 })
    fetchAnomalies.mockResolvedValue({ data: [ALERT] })
    render(<AnomalyAlertsCard initialAlerts={[]} />)

    fireEvent.click(screen.getByRole('button', { name: 'Analyser maintenant' }))

    expect(await screen.findByText('pic de commandes')).toBeTruthy()
    expect(screen.getByText('1 alerte(s) créée(s) ou mise(s) à jour.')).toBeTruthy()
  })
})
