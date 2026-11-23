import { describe, expect, it } from 'vitest'
import { attachmentError, dayLabel, formatFileSize, mergeMessages, messagePreview } from './messageUtils'

describe('messageUtils', () => {
  it('fusionne les messages sans doublon et dans l’ordre', () => {
    expect(mergeMessages([{ id: 2 }, { id: 5 }], [{ id: 3 }, { id: 5, body: 'à jour' }])).toEqual([
      { id: 2 },
      { id: 3 },
      { id: 5, body: 'à jour' },
    ])
  })

  it('contrôle le format et la taille de la pièce jointe', () => {
    expect(attachmentError({ name: 'Plan.PDF', size: 1000 })).toBeNull()
    expect(attachmentError({ name: 'page.html', size: 10 })).toMatch(/Formats acceptés/)
    expect(attachmentError({ name: 'sans-extension', size: 10 })).toMatch(/Formats acceptés/)
    expect(attachmentError({ name: 'gros.zip', size: 10 * 1024 * 1024 + 1 })).toMatch(/10 Mo/)
  })

  it('résume le dernier message', () => {
    expect(messagePreview(null)).toBe('')
    expect(messagePreview({ body: 'Bonjour', is_mine: true })).toBe('Vous : Bonjour')
    expect(messagePreview({ body: '', is_mine: false, attachment: { name: 'plan.pdf' } })).toBe('📎 plan.pdf')
  })

  it('affiche les jours et les tailles', () => {
    const now = new Date(2026, 10, 23, 0, 30)
    expect(dayLabel(new Date(2026, 10, 23, 0, 10), now)).toBe("Aujourd'hui")
    expect(dayLabel(new Date(2026, 10, 22, 23, 50), now)).toBe('Hier')
    expect(formatFileSize(1536 * 1024)).toBe('1,5 Mo')
  })
})
