import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { fetchAdminDashboard } from '@/api/adminDashboard'
import { useAdminDashboardStore } from '@/stores/adminDashboard'
import AdminDashboardView from './AdminDashboardView'

vi.mock('@/api/adminDashboard', () => ({
  fetchAdminDashboard: vi.fn(),
}))

// Recharts mesure son conteneur (largeur 0 dans jsdom) : on garde le test sur le
// contenu du tableau de bord, pas sur le rendu SVG de la librairie.
vi.mock('recharts', () => {
  const PassThrough = ({ children }) => children ?? null
  return {
    ResponsiveContainer: PassThrough,
    LineChart: PassThrough,
    Line: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
  }
})

function fixture(overrides = {}) {
  return {
    period: { from: '2027-01-01', to: '2027-01-31', days: 31, timezone: 'Africa/Tunis' },
    kpis: {
      active_users: 42,
      validated_suppliers: 7,
      orders_count: 120,
      revenue: '1500.00',
      tenders_count: 9,
    },
    series: [
      { date: '2027-01-01', signups: 1, orders: 2, tenders: 0 },
      { date: '2027-01-02', signups: 0, orders: 1, tenders: 3 },
    ],
    validation_queue: {
      count: 2,
      items: [
        {
          id: 1,
          company_name: 'Acme SARL',
          submitted_at: '2027-01-03T09:00:00+01:00',
          waiting_days: 5,
        },
      ],
    },
    urgent_disputes: {
      count: 1,
      items: [
        {
          id: 9,
          order_id: 55,
          reason: 'Produit non conforme',
          opened_at: '2027-01-04T09:00:00+01:00',
          age_days: 3,
        },
      ],
    },
    top_categories: [{ id: 1, name: 'Informatique', products_count: 12 }],
    anomaly_alerts: [],
    generated_at: '2027-02-01T09:00:00+01:00',
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminDashboardView />
    </MemoryRouter>,
  )
}

describe('AdminDashboardView (SCRUM-122)', () => {
  beforeEach(() => {
    useAdminDashboardStore.getState().reset()
    vi.mocked(fetchAdminDashboard).mockReset()
  })

  afterEach(() => {
    cleanup()
    useAdminDashboardStore.getState().reset()
    vi.clearAllMocks()
  })

  it('affiche le chargement puis les indicateurs, la courbe et les files', async () => {
    vi.mocked(fetchAdminDashboard).mockResolvedValue(fixture())

    renderPage()

    expect(screen.getByRole('status', { name: /Chargement du tableau de bord/ })).toBeTruthy()

    expect(await screen.findByText('Utilisateurs actifs')).toBeTruthy()
    expect(screen.getByText('42')).toBeTruthy()
    expect(screen.getByText(/1.500,00 TND/)).toBeTruthy()
    expect(screen.getByText('Acme SARL')).toBeTruthy()
    expect(screen.getByText('Produit non conforme')).toBeTruthy()
    expect(screen.getByText(/Informatique/)).toBeTruthy()
    expect(screen.getByRole('img', { name: /Évolution des inscriptions/ })).toBeTruthy()

    expect(fetchAdminDashboard).toHaveBeenCalledWith(
      expect.objectContaining({ from: expect.any(String), to: expect.any(String) }),
    )
  })

  it('affiche les états vides quand la période ne contient aucune donnée', async () => {
    vi.mocked(fetchAdminDashboard).mockResolvedValue(
      fixture({
        series: [],
        validation_queue: { count: 0, items: [] },
        urgent_disputes: { count: 0, items: [] },
        top_categories: [],
      }),
    )

    renderPage()

    expect(await screen.findByText('Aucune donnée sur cette période')).toBeTruthy()
    expect(screen.getByText('Aucun dossier en attente')).toBeTruthy()
    expect(screen.getByText('Aucun litige ouvert')).toBeTruthy()
    expect(screen.getByText('Aucune catégorie active')).toBeTruthy()
    expect(screen.getByText("Aucune alerte d'anomalie")).toBeTruthy()
  })

  it('affiche une erreur et permet de réessayer', async () => {
    vi.mocked(fetchAdminDashboard).mockRejectedValueOnce(
      Object.assign(new Error('boom'), { userMessage: 'Le serveur est indisponible.' }),
    )

    renderPage()

    expect(await screen.findByText('Le serveur est indisponible.')).toBeTruthy()

    vi.mocked(fetchAdminDashboard).mockResolvedValue(fixture())
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    expect(await screen.findByText('Utilisateurs actifs')).toBeTruthy()
    expect(fetchAdminDashboard).toHaveBeenCalledTimes(2)
  })

  it('recharge le tableau de bord quand la période change', async () => {
    vi.mocked(fetchAdminDashboard).mockResolvedValue(fixture())

    renderPage()
    await screen.findByText('Utilisateurs actifs')

    fireEvent.change(screen.getByLabelText('Du'), { target: { value: '2027-01-05' } })
    fireEvent.change(screen.getByLabelText('Au'), { target: { value: '2027-01-31' } })
    fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }))

    await waitFor(() => {
      expect(fetchAdminDashboard).toHaveBeenLastCalledWith(
        expect.objectContaining({ from: '2027-01-05', to: '2027-01-31' }),
      )
    })
  })

  it('refuse une période inversée sans appeler l’API', async () => {
    vi.mocked(fetchAdminDashboard).mockResolvedValue(fixture())

    renderPage()
    await screen.findByText('Utilisateurs actifs')

    fireEvent.change(screen.getByLabelText('Du'), { target: { value: '2099-12-31' } })
    fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }))

    expect(await screen.findByText('La date de début doit précéder la date de fin.')).toBeTruthy()
    expect(fetchAdminDashboard).toHaveBeenCalledTimes(1)
  })
})
