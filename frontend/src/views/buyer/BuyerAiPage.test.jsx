import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { generateTenderDraft } from '@/api/ai'
import { fetchBuyerTenders } from '@/api/tenders'
import BuyerAiPage from './BuyerAiPage'

vi.mock('@/api/ai', () => ({
  generateTenderDraft: vi.fn(),
  generateProductText: vi.fn(),
  acceptAiSuggestion: vi.fn(),
}))

vi.mock('@/api/tenders', () => ({
  fetchBuyerTenders: vi.fn(),
}))

beforeEach(() => {
  fetchBuyerTenders.mockResolvedValue({ data: [{ id: 9, title: 'Achat de cartons' }] })
  generateTenderDraft.mockResolvedValue({
    interaction_id: 11,
    output: 'Brouillon structuré pour des cartons.',
    editable: true,
    simulated: true,
    label: 'Mode simulé, sans IA',
    before: null,
    after: 'Brouillon structuré pour des cartons.',
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('BuyerAiPage (SCRUM-124 / SCRUM-79)', () => {
  it('génère un brouillon de demande modifiable', async () => {
    render(<BuyerAiPage />, { wrapper: MemoryRouter })

    fireEvent.change(screen.getByLabelText('Votre besoin'), {
      target: { value: 'fourniture de cartons double cannelure' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Générer un brouillon' }))

    await waitFor(() =>
      expect(generateTenderDraft).toHaveBeenCalledWith({
        prompt: 'fourniture de cartons double cannelure',
        category: null,
        region: null,
      }),
    )
    await waitFor(() =>
      expect(screen.getByLabelText('Texte proposé').value).toBe('Brouillon structuré pour des cartons.'),
    )
    expect(screen.getByText(/Mode simulé, sans IA/)).toBeTruthy()
  })

  it('mène à la page de comparaison de la demande choisie', async () => {
    render(<BuyerAiPage />, { wrapper: MemoryRouter })

    const option = await screen.findByRole('option', { name: 'Achat de cartons' })
    expect(option).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Demande'), { target: { value: '9' } })
    expect(screen.getByRole('link', { name: 'Comparer' }).getAttribute('href')).toBe('/porteur/devis/9/comparer')
  })
})
