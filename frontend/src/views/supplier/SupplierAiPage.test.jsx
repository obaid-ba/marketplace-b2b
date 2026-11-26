import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { generateProductText } from '@/api/ai'
import SupplierAiPage from './SupplierAiPage'

vi.mock('@/api/ai', () => ({
  generateQuoteSummary: vi.fn(),
  generateTenderDraft: vi.fn(),
  generateProductText: vi.fn(),
  acceptAiSuggestion: vi.fn(),
}))

beforeEach(() => {
  generateProductText.mockResolvedValue({
    interaction_id: 21,
    output: 'Perceuse sans fil 18 V livrée avec deux batteries.',
    editable: true,
    label: 'Reformulation de texte produit',
    before: 'perceuse 18v 2 batteries',
    after: 'Perceuse sans fil 18 V livrée avec deux batteries.',
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('SupplierAiPage (SCRUM-77 / SCRUM-78)', () => {
  it('reformule un texte produit et affiche avant/après', async () => {
    render(<SupplierAiPage />)

    fireEvent.change(screen.getByLabelText('Votre texte ou vos notes'), {
      target: { value: 'perceuse 18v 2 batteries' },
    })
    fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'rephrase' } })
    fireEvent.click(screen.getByRole('button', { name: 'Générer le texte' }))

    await waitFor(() =>
      expect(generateProductText).toHaveBeenCalledWith({
        text: 'perceuse 18v 2 batteries',
        action: 'rephrase',
        category: null,
      }),
    )

    expect(screen.getAllByText('perceuse 18v 2 batteries').length).toBeGreaterThan(0)
    await waitFor(() =>
      expect(screen.getByLabelText('Après').value).toBe(
        'Perceuse sans fil 18 V livrée avec deux batteries.',
      ),
    )
  })
})
