import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { fetchSupplierDashboard } from '@/api/supplierDashboard'
import { useAuthStore } from '@/stores/auth'
import SupplierDashboard from './SupplierDashboard'

vi.mock('@/api/supplierDashboard', () => ({
  fetchSupplierDashboard: vi.fn(),
}))

// Recharts mesure son conteneur (largeur 0 dans jsdom) : on teste le contenu, pas le SVG.
vi.mock('recharts', () => {
  const PassThrough = ({ children }) => children ?? null
  return {
    ResponsiveContainer: PassThrough,
    LineChart: PassThrough,
    AreaChart: PassThrough,
    Area: () => null,
    Line: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
  }
})

const dashboard = {
  period: { from: '2027-01-01', to: '2027-01-31', days: 31 },
  kpis: {
    revenue: '800.00',
    orders_count: 2,
    orders_in_progress: 1,
    orders_finished: 1,
    accepted_quote_rate: 50,
    quotes_count: 2,
    average_rating: 4.25,
    reviews_count: 2,
    views_count: 3,
    unread_items: 2,
  },
  negative_review_alert: { count: 1, threshold: 2, active: true },
  series: [{ date: '2027-01-10', orders: 2, revenue: 800 }],
  most_viewed_products: [{ id: 4, title: 'Carton double cannelure', views_count: 3 }],
  most_sold_products: [{ id: 4, title: 'Carton double cannelure', quantity_sold: 40, revenue: 500 }],
  open_requests: [{ id: 9, title: 'Demande prioritaire', score: 90, budget: 5000, desired_deadline: '2027-02-01' }],
  latest_reviews: [{ id: 1, rating: 1, comment: 'Cartons écrasés', author: 'Karim Ben Salah' }],
}

beforeEach(() => {
  useAuthStore.setState({ user: { id: 1, name: 'Amel', role: 'supplier' } })
  fetchSupplierDashboard.mockResolvedValue(dashboard)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('SupplierDashboard (F26)', () => {
  it('affiche les indicateurs, l’alerte avis et les classements', async () => {
    render(
      <MemoryRouter>
        <SupplierDashboard />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Bonjour Amel' })).toBeTruthy()
    expect(screen.getByText('Revenu')).toBeTruthy()
    expect(screen.getByText(/800,00/)).toBeTruthy()
    expect(screen.getByText('50 %')).toBeTruthy()
    expect(screen.getByText('4.25 / 5')).toBeTruthy()
    expect(screen.getByText('1 avis négatif publié sur la période (note ≤ 2/5).')).toBeTruthy()

    expect(screen.getAllByText('Carton double cannelure').length).toBe(2)
    expect(screen.getByText('3 vues')).toBeTruthy()
    expect(screen.getByText('40 unités vendues')).toBeTruthy()
    expect(screen.getByText('Demande prioritaire')).toBeTruthy()
    expect(screen.getByText('Karim Ben Salah')).toBeTruthy()
  })
})
