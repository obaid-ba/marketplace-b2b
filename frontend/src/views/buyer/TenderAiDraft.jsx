import { useState } from 'react'
import { generateTenderDraft } from '@/api/ai'
import AiSuggestion from '@/components/AiSuggestion'

const MIN_KEYWORDS = 5

/**
 * « Rédiger avec l'IA » dans « Publier une demande » (SCRUM-77 / F30) : titre + mots-clés → description proposée,
 * entièrement modifiable. L'IA indisponible n'empêche jamais de rédiger soi-même.
 */
export default function TenderAiDraft({ title, category, region, onUse }) {
  const [open, setOpen] = useState(false)
  const [keywords, setKeywords] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function generate() {
    setLoading(true)
    setError(null)
    try {
      setResult(await generateTenderDraft({ title: title.trim() || null, prompt: keywords.trim(), category: category ?? null, region: region ?? null }))
    } catch (err) {
      setError(err.response?.data?.message ?? err.userMessage ?? "La description n'a pas pu être générée.")
    } finally {
      setLoading(false)
    }
  }

  function close() {
    setOpen(false)
    setResult(null)
    setError(null)
  }

  if (!open) {
    return (
      <button type="button" className="btn-secondary mt-2" onClick={() => setOpen(true)}>
        ✦ Rédiger avec l’IA
      </button>
    )
  }

  return (
    <div className="mt-2 rounded-xl border border-line p-4">
      <label htmlFor="ai-keywords" className="mb-1 block text-sm font-medium text-ink">
        Mots-clés de votre besoin
      </label>
      <textarea
        id="ai-keywords"
        rows={2}
        maxLength={1000}
        className="input"
        placeholder="Ex. 2000 cartons, double cannelure, livraison à Sfax"
        value={keywords}
        onChange={(event) => setKeywords(event.target.value)}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary" onClick={generate} disabled={loading || keywords.trim().length < MIN_KEYWORDS}>
          {loading ? 'Rédaction…' : result ? 'Proposer un autre texte' : 'Proposer une description'}
        </button>
        <button type="button" className="btn-ghost" onClick={close}>
          Annuler
        </button>
        <span className="text-xs text-muted">Le titre, la catégorie et la région choisis sont pris en compte.</span>
      </div>
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <AiSuggestion
        result={result}
        onDismiss={close}
        onUse={(text) => {
          onUse(text)
          close()
        }}
      />
    </div>
  )
}
