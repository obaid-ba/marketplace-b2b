import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import ReviewInsights from './ReviewInsights'

afterEach(cleanup)

describe('ReviewInsights (SCRUM-83)', () => {
  it('ne montre rien sans résumé', () => {
    const { container } = render(<ReviewInsights summary={null} />)
    expect(container.innerHTML).toBe('')
  })

  it('affiche synthèse, points forts, points faibles et le mode simulé', () => {
    render(
      <ReviewInsights
        summary={{ summary: '4 avis analysés.', strengths: ['Livraison rapide'], weaknesses: [], reviews_count: 4, simulated: true }}
      />,
    )

    expect(screen.getByText('4 avis analysés.')).toBeTruthy()
    expect(screen.getByText('+ Livraison rapide')).toBeTruthy()
    expect(screen.getByText('Aucun point faible récurrent.')).toBeTruthy()
    expect(screen.getByText('Résumé automatique (mode simulé)')).toBeTruthy()
    expect(screen.getByText('Basé sur les 4 derniers avis publiés.')).toBeTruthy()
  })
})
