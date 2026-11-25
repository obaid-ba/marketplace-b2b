import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { analyzeTender } from '@/api/tenders'
import TenderAiAnalysis from './TenderAiAnalysis'

vi.mock('@/api/http', () => ({ http: { post: vi.fn() }, onAuthError: vi.fn() }))
vi.mock('@/api/tenders', () => ({ analyzeTender: vi.fn() }))

const RESULT = {
  interaction_id: 42,
  category: { id: 5, name: 'Cartonnage', parent_id: 1 },
  keywords: ['cartons', 'ondulés'],
  confidence: 70,
  suggested_suppliers: [
    { id: 7, company_name: 'Atlas Emballages', region: 'Sfax', rating_avg: 4.6, score: 85, reasons: ['Propose « Cartonnage »', 'Situé dans votre région'] },
    { id: 8, company_name: 'Djerba Pack', region: 'Médenine', rating_avg: 4.3, score: 55, reasons: [] },
  ],
  simulated: true,
  label: 'Mode simulé, sans IA — à vérifier : vous restez libre de vos choix.',
}

function setup(props = {}) {
  const handlers = { onCategory: vi.fn(), onChange: vi.fn() }
  render(
    <TenderAiAnalysis
      title="Cartons ondulés"
      description="Nous cherchons 5000 cartons ondulés pour nos expéditions."
      categoryId=""
      regionId=""
      categoryLabel={(id) => (id === 5 ? 'Cartonnage' : undefined)}
      {...handlers}
      {...props}
    />,
  )
  return handlers
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('TenderAiAnalysis (SCRUM-81)', () => {
  it('attend un titre et une description suffisants', () => {
    setup({ description: 'trop court' })
    expect(screen.getByRole('button', { name: 'Analyser ma demande' }).disabled).toBe(true)
  })

  it('applique la catégorie proposée si aucune n’est choisie et liste les fournisseurs', async () => {
    analyzeTender.mockResolvedValue(RESULT)
    const { onCategory, onChange } = setup({ regionId: '3' })

    fireEvent.click(screen.getByRole('button', { name: 'Analyser ma demande' }))

    expect(await screen.findByText('Atlas Emballages')).toBeTruthy()
    expect(analyzeTender).toHaveBeenCalledWith(expect.objectContaining({ region_id: '3', category_id: '' }))
    expect(onCategory).toHaveBeenCalledWith('5')
    expect(onChange).toHaveBeenLastCalledWith({ interactionId: 42, supplierIds: [] })
    expect(screen.getByText('cartons')).toBeTruthy()
    expect(screen.getByText(/Mode simulé, sans IA/)).toBeTruthy()
  })

  it('garde la catégorie choisie et propose de l’échanger', async () => {
    analyzeTender.mockResolvedValue(RESULT)
    const { onCategory } = setup({ categoryId: '9' })

    fireEvent.click(screen.getByRole('button', { name: 'Analyser ma demande' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Utiliser cette catégorie' }))

    expect(onCategory).toHaveBeenCalledTimes(1)
    expect(onCategory).toHaveBeenCalledWith('5')
  })

  it('transmet les fournisseurs cochés', async () => {
    analyzeTender.mockResolvedValue(RESULT)
    const { onChange } = setup()

    fireEvent.click(screen.getByRole('button', { name: 'Analyser ma demande' }))
    fireEvent.click(await screen.findByRole('checkbox', { name: /Djerba Pack/ }))

    expect(onChange).toHaveBeenLastCalledWith({ interactionId: 42, supplierIds: [8] })
  })

  it('affiche un message clair si l’IA est indisponible', async () => {
    analyzeTender.mockRejectedValue({ response: { data: { message: "L'aide de l'IA n'est pas disponible pour le moment." } } })
    setup()

    fireEvent.click(screen.getByRole('button', { name: 'Analyser ma demande' }))

    expect((await screen.findByRole('alert')).textContent).toContain("n'est pas disponible")
  })
})
