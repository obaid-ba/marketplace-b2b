import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { acceptAiSuggestion, generateTenderDraft } from '@/api/ai'
import TenderAiDraft from './TenderAiDraft'

vi.mock('@/api/ai', () => ({ generateTenderDraft: vi.fn(), acceptAiSuggestion: vi.fn() }))

beforeEach(() => {
  vi.mocked(generateTenderDraft).mockReset()
  vi.mocked(generateTenderDraft).mockResolvedValue({ interaction_id: 4, output: 'Description proposée', simulated: true, before: null })
  vi.mocked(acceptAiSuggestion).mockReset()
  vi.mocked(acceptAiSuggestion).mockResolvedValue({})
})
afterEach(cleanup)

const open = (onUse = vi.fn()) => {
  render(<TenderAiDraft title=" Cartons " category="Emballage" region="Sfax" onUse={onUse} />)
  fireEvent.click(screen.getByRole('button', { name: /Rédiger avec l’IA/ }))
  return onUse
}

describe('Rédiger une demande avec l’IA (SCRUM-77)', () => {
  it('propose un texte modifiable à partir du titre et des mots-clés, puis l’utilise', async () => {
    const onUse = open()
    const generate = screen.getByRole('button', { name: 'Proposer une description' })
    expect(generate.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Mots-clés de votre besoin'), { target: { value: '2000 cartons' } })
    fireEvent.click(generate)

    const text = await screen.findByLabelText('Texte proposé')
    expect(generateTenderDraft).toHaveBeenCalledWith({ title: 'Cartons', prompt: '2000 cartons', category: 'Emballage', region: 'Sfax' })
    expect(screen.getByText(/Mode simulé, sans IA/)).toBeTruthy()
    fireEvent.change(text, { target: { value: 'Ma version' } })
    fireEvent.click(screen.getByRole('button', { name: 'Utiliser ce texte' }))

    expect(onUse).toHaveBeenCalledWith('Ma version')
    expect(acceptAiSuggestion).toHaveBeenCalledWith(4, 'Ma version')
    expect(screen.queryByLabelText('Texte proposé')).toBeNull()
  })

  it('affiche un message clair si l’IA est indisponible', async () => {
    vi.mocked(generateTenderDraft).mockRejectedValue(Object.assign(new Error(), { response: { data: { message: "L'aide de l'IA n'est pas disponible." } } }))
    const onUse = open()
    fireEvent.change(screen.getByLabelText('Mots-clés de votre besoin'), { target: { value: '2000 cartons' } })
    fireEvent.click(screen.getByRole('button', { name: 'Proposer une description' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/pas disponible/)
    expect(onUse).not.toHaveBeenCalled()
  })
})
