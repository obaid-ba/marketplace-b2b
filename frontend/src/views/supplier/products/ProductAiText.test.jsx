import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { acceptAiSuggestion, generateProductText } from '@/api/ai'
import ProductAiText from './ProductAiText'

vi.mock('@/api/ai', () => ({ generateProductText: vi.fn(), acceptAiSuggestion: vi.fn() }))

beforeEach(() => {
  vi.mocked(generateProductText).mockReset()
  vi.mocked(generateProductText).mockImplementation(async ({ text }) => ({ interaction_id: 9, output: 'Perceuse 18 V.', before: text, simulated: false }))
  vi.mocked(acceptAiSuggestion).mockReset()
  vi.mocked(acceptAiSuggestion).mockRejectedValue(new Error()) // ne doit pas empêcher de reprendre le texte
})
afterEach(cleanup)

const show = (props) => {
  const onUse = vi.fn()
  render(<ProductAiText title="" description="" category="Outillage" onUse={onUse} {...props} />)
  return onUse
}

describe('Texte produit avec l’IA (SCRUM-78)', () => {
  it('reformule la description, compare avant / après et l’utilise', async () => {
    const onUse = show({ description: 'perceuse 18v' })
    fireEvent.click(screen.getByRole('button', { name: /Reformuler/ }))
    expect((await screen.findByLabelText('Après')).value).toBe('Perceuse 18 V.')
    expect(screen.getByText('perceuse 18v')).toBeTruthy()
    expect(generateProductText).toHaveBeenCalledWith({ text: 'perceuse 18v', action: 'rephrase', category: 'Outillage' })
    fireEvent.click(screen.getByRole('button', { name: 'Utiliser ce texte' }))
    expect(onUse).toHaveBeenCalledWith('Perceuse 18 V.')
  })

  it('garde le texte de l’utilisateur', async () => {
    const onUse = show({ description: 'perceuse 18v' })
    fireEvent.click(screen.getByRole('button', { name: /Rédiger/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Garder mon texte' }))
    expect(screen.queryByLabelText('Après')).toBeNull()
    expect(onUse).not.toHaveBeenCalled()
  })

  it('sans description, rédige à partir du titre et ne propose pas de reformuler', async () => {
    show({ title: 'Perceuse' })
    expect(screen.getByRole('button', { name: /Reformuler/ }).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /Rédiger/ }))
    expect(await screen.findByLabelText('Texte proposé')).toBeTruthy()
    expect(generateProductText).toHaveBeenCalledWith({ text: 'Perceuse', action: 'draft', category: 'Outillage' })
  })
})
