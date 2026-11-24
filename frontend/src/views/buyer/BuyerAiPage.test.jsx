import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { generateQuoteSummary, generateTenderDraft } from '@/api/ai'
import { fetchBuyerTenders } from '@/api/tenders'
import BuyerAiPage from './BuyerAiPage'

vi.mock('@/api/ai', () => ({
  generateQuoteSummary: vi.fn(),
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
    label: 'Brouillon généré par IA',
    before: null,
    after: 'Brouillon structuré pour des cartons.',
  })
  generateQuoteSummary.mockResolvedValue({
    interaction_id: 12,
    output: 'Atlas est moins cher, Médina plus rapide.',
    editable: true,
    label: 'Aide à la décision générée par IA',
    before: null,
    after: 'Atlas est moins cher, Médina plus rapide.',
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('BuyerAiPage (SCRUM-124 / SCRUM-79)', () => {
  it('génère un brouillon de demande modifiable', async () => {
    render(<BuyerAiPage />)

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
  })

  it('compare les devis d’une demande', async () => {
    render(<BuyerAiPage />)

    const option = await screen.findByRole('option', { name: 'Achat de cartons' })
    expect(option).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Demande'), { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: 'Comparer' }))

    await waitFor(() => expect(generateQuoteSummary).toHaveBeenCalledWith(9))
    await waitFor(() =>
      expect(screen.getByLabelText('Texte proposé').value).toContain('Atlas est moins cher'),
    )
  })
})
