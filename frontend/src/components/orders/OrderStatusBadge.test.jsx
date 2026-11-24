import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { OrderStatusProgress } from './OrderStatusBadge'

afterEach(cleanup)

const currentStep = () => screen.getAllByRole('listitem').find((item) => item.getAttribute('aria-current') === 'step')

describe('OrderStatusProgress', () => {
  it('indique l’étape en cours', () => {
    render(<OrderStatusProgress status="expédiée" />)
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
    expect(currentStep().textContent).toMatch(/Expédiée\(En cours\)/)
  })

  it('une commande clôturée est terminée, pas en cours', () => {
    render(<OrderStatusProgress status="clôturée" />)
    expect(currentStep().textContent).toMatch(/Clôturée\(Terminée\)/)
    expect(screen.queryByText('(En cours)')).toBeNull()
  })
})
