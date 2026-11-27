import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { useFormDraft } from './useFormDraft'

function Form({ draftKey = 'test', ready = true }) {
  const [form, setForm] = useState({ title: '', body: '' })
  const draft = useFormDraft(draftKey, form, setForm, { ready })
  return (
    <>
      <input aria-label="Titre" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
      {draft.restored && <p>Restauré</p>}
      <button type="button" onClick={draft.clear}>
        Effacer
      </button>
    </>
  )
}

beforeEach(() => window.localStorage.clear())
afterEach(cleanup)

describe('useFormDraft (SCRUM-92)', () => {
  it('conserve la saisie et la restaure à la réouverture', () => {
    render(<Form />)
    fireEvent.change(screen.getByLabelText('Titre'), { target: { value: 'Cartons ondulés' } })
    cleanup()

    render(<Form />)

    expect(screen.getByLabelText('Titre').value).toBe('Cartons ondulés')
    expect(screen.getByText('Restauré')).toBeTruthy()
  })

  it('efface le brouillon après un envoi réussi', () => {
    render(<Form />)
    fireEvent.change(screen.getByLabelText('Titre'), { target: { value: 'Brouillon' } })
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Effacer' })))
    cleanup()
    window.localStorage.removeItem('marketplace:draft:test') // la saisie suivante réécrirait le brouillon

    render(<Form />)
    expect(screen.getByLabelText('Titre').value).toBe('')
  })

  it('attend que la page soit chargée et ne fait rien sans clé', () => {
    window.localStorage.setItem('marketplace:draft:test', JSON.stringify({ savedAt: Date.now(), value: { title: 'Ancien' } }))

    const { rerender } = render(<Form ready={false} />)
    expect(screen.getByLabelText('Titre').value).toBe('')
    rerender(<Form ready />)
    expect(screen.getByLabelText('Titre').value).toBe('Ancien')
    cleanup()

    render(<Form draftKey={null} />)
    expect(screen.getByLabelText('Titre').value).toBe('')
  })
})
