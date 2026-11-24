import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StrictMode } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { fetchQuoteSummary, generateQuoteSummary, updateQuoteSummary } from '@/api/quoteSummary'
import QuoteSummaryCard from './QuoteSummaryCard'

vi.mock('@/api/quoteSummary', () => ({ fetchQuoteSummary: vi.fn(), generateQuoteSummary: vi.fn(), updateQuoteSummary: vi.fn() }))

const QUOTES = [
  { id: 1, supplier: { company_name: 'Atlas SARL' } },
  { id: 2, supplier: { company_name: 'Cartons du Sud' } },
]

const result = (summary = {}, extra = {}) => ({
  can_generate: true,
  summary: {
    id: 9,
    text: 'Deux devis proches.',
    original_text: 'Deux devis proches.',
    edited: false,
    accepted: false,
    simulated: true,
    stale: false,
    created_at: '2026-11-24T10:00:00+01:00',
    quotes: [
      { quote_id: 1, strengths: ['Prix le plus bas.'], concerns: [], questions: ['Quelle garantie ?'] },
      { quote_id: 2, strengths: [], concerns: [], questions: [] },
    ],
    ...summary,
  },
  ...extra,
})

const failure = (message, status = 503) => Object.assign(new Error(message), { response: { status, data: { message } }, userMessage: 'Erreur du serveur. Réessayez plus tard.' })

beforeEach(() => {
  vi.mocked(fetchQuoteSummary).mockReset()
  vi.mocked(generateQuoteSummary).mockReset()
  vi.mocked(updateQuoteSummary).mockReset()
})

afterEach(cleanup)

const show = (quotes = QUOTES) => render(<QuoteSummaryCard tenderId={4} quotes={quotes} />)

describe('QuoteSummaryCard (SCRUM-119)', () => {
  it('affiche le résumé enregistré sans en générer un autre, et dit qu’il est simulé', async () => {
    vi.mocked(fetchQuoteSummary).mockResolvedValue(result())
    show()
    expect(await screen.findByText('Deux devis proches.')).toBeTruthy()
    expect(screen.getByText('Mode simulé, sans IA')).toBeTruthy()
    expect(screen.getByText(/la décision vous appartient/)).toBeTruthy()
    expect(generateQuoteSummary).not.toHaveBeenCalled()

    const atlas = screen.getByText('Atlas SARL').closest('li')
    expect(within(atlas).getByText('Prix le plus bas.')).toBeTruthy()
    expect(within(screen.getByText('Cartons du Sud').closest('li')).getByText(/Rien de particulier/)).toBeTruthy()
  })

  it('distingue une réponse d’IA du mode simulé', async () => {
    vi.mocked(fetchQuoteSummary).mockResolvedValue(result({ simulated: false }))
    show()
    expect(await screen.findByText('Généré par IA')).toBeTruthy()
  })

  it.each([
    ['manque', { can_generate: true, summary: null }],
    ['est périmé', result({ stale: true, text: 'Ancien' })],
  ])('génère le résumé quand il %s', async (_, initial) => {
    vi.mocked(fetchQuoteSummary).mockResolvedValue(initial)
    vi.mocked(generateQuoteSummary).mockResolvedValue(result({ text: 'Nouveau résumé.' }))
    show()
    expect(await screen.findByText('Nouveau résumé.')).toBeTruthy()
    expect(generateQuoteSummary).toHaveBeenCalledExactlyOnceWith(4, { force: false })
  })

  it('ne génère qu’une fois en mode strict', async () => {
    vi.mocked(fetchQuoteSummary).mockResolvedValue({ can_generate: true, summary: null })
    vi.mocked(generateQuoteSummary).mockResolvedValue(result())
    render(
      <StrictMode>
        <QuoteSummaryCard tenderId={4} quotes={QUOTES} />
      </StrictMode>,
    )
    await screen.findByText('Deux devis proches.')
    expect(generateQuoteSummary).toHaveBeenCalledTimes(1)
  })

  it('n’affiche rien s’il n’y a pas de résumé possible ou si l’API échoue', async () => {
    vi.mocked(fetchQuoteSummary).mockResolvedValueOnce({ can_generate: false, summary: null })
    show()
    await waitFor(() => expect(fetchQuoteSummary).toHaveBeenCalled())
    expect(screen.queryByRole('region')).toBeNull()
    cleanup()

    vi.mocked(fetchQuoteSummary).mockRejectedValueOnce(failure('panne'))
    show()
    await waitFor(() => expect(fetchQuoteSummary).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('garde l’ancien résumé et propose de réessayer si la génération échoue', async () => {
    vi.mocked(fetchQuoteSummary).mockResolvedValue(result({ stale: true, text: 'Ancien' }))
    vi.mocked(generateQuoteSummary).mockRejectedValueOnce(failure("L'aide de l'IA n'est pas disponible pour le moment."))
    show()
    expect((await screen.findByRole('alert')).textContent).toMatch(/n'est pas disponible/)
    expect(screen.getByText('Ancien')).toBeTruthy()

    vi.mocked(generateQuoteSummary).mockResolvedValueOnce(result({ text: 'Nouveau' }))
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByText('Nouveau')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('modifie le texte puis rétablit l’original', async () => {
    vi.mocked(fetchQuoteSummary).mockResolvedValue(result())
    vi.mocked(updateQuoteSummary).mockResolvedValueOnce(result({ text: 'Ma version.', edited: true }))
    show()
    fireEvent.click(await screen.findByRole('button', { name: 'Modifier' }))
    fireEvent.change(screen.getByLabelText('Texte du résumé'), { target: { value: ' Ma version. ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByText('Modifié par vous')).toBeTruthy()
    expect(updateQuoteSummary).toHaveBeenCalledWith(4, { summary: 'Ma version.' })

    vi.mocked(updateQuoteSummary).mockResolvedValueOnce(result())
    fireEvent.click(screen.getByRole('button', { name: 'Modifier' }))
    fireEvent.click(screen.getByRole('button', { name: "Rétablir l'original" }))
    expect(await screen.findByText('Deux devis proches.')).toBeTruthy()
    expect(updateQuoteSummary).toHaveBeenLastCalledWith(4, { summary: 'Deux devis proches.' })
  })

  it('garde la saisie si l’enregistrement échoue', async () => {
    vi.mocked(fetchQuoteSummary).mockResolvedValue(result())
    vi.mocked(updateQuoteSummary).mockRejectedValue(failure('x', 500))
    show()
    fireEvent.click(await screen.findByRole('button', { name: 'Modifier' }))
    fireEvent.change(screen.getByLabelText('Texte du résumé'), { target: { value: 'Ma version.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await screen.findByRole('alert')
    expect(screen.getByLabelText('Texte du résumé').value).toBe('Ma version.')
  })

  it('marque le résumé comme utile et le régénère à la demande', async () => {
    vi.mocked(fetchQuoteSummary).mockResolvedValue(result())
    vi.mocked(updateQuoteSummary).mockResolvedValue(result({ accepted: true }))
    vi.mocked(generateQuoteSummary).mockResolvedValue(result({ text: 'Encore.' }))
    show()
    fireEvent.click(await screen.findByRole('button', { name: 'Ce résumé est utile' }))
    expect(await screen.findByText('Utile')).toBeTruthy()
    expect(updateQuoteSummary).toHaveBeenCalledWith(4, { accepted: true })
    fireEvent.click(screen.getByRole('button', { name: 'Régénérer' }))
    expect(await screen.findByText('Encore.')).toBeTruthy()
    expect(generateQuoteSummary).toHaveBeenCalledWith(4, { force: true })
  })

  it('une demande close garde son résumé, sans régénération', async () => {
    vi.mocked(fetchQuoteSummary).mockResolvedValue(result({}, { can_generate: false }))
    show()
    await screen.findByText('Deux devis proches.')
    expect(screen.queryByRole('button', { name: 'Régénérer' })).toBeNull()
  })

  it('ignore un devis qui n’est plus affiché', async () => {
    vi.mocked(fetchQuoteSummary).mockResolvedValue(result())
    show([QUOTES[0]])
    await screen.findByText('Atlas SARL')
    expect(screen.queryByText('Cartons du Sud')).toBeNull()
  })
})
