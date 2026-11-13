import { describe, expect, it } from 'vitest'
import { formatRelativeDate } from './relativeDate'

const now = new Date(2026, 10, 13, 15, 30) // 13 nov. 2026, 15:30 (heure locale)

describe('formatRelativeDate', () => {
  it("affiche « Aujourd'hui » et « Hier » avec l'heure", () => {
    expect(formatRelativeDate(new Date(2026, 10, 13, 9, 12), now)).toBe('Aujourd’hui, 09:12')
    expect(formatRelativeDate(new Date(2026, 10, 12, 17, 40), now)).toBe('Hier, 17:40')
  })

  it('affiche le jour et le mois abrégé au-delà', () => {
    expect(formatRelativeDate(new Date(2026, 10, 10, 14, 5), now)).toBe('10 nov., 14:05')
    expect(formatRelativeDate(new Date(2025, 10, 12, 14, 5), now)).toBe('12 nov. 2025, 14:05')
  })

  it('renvoie null sans date valide', () => {
    expect(formatRelativeDate(null, now)).toBeNull()
    expect(formatRelativeDate('pas une date', now)).toBeNull()
  })
})
