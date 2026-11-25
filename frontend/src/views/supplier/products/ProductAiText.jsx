import { useState } from 'react'
import { generateProductText } from '@/api/ai'
import AiSuggestion from '@/components/AiSuggestion'

const MIN_LENGTH = 3

/**
 * « Rédiger » et « Reformuler » dans l'éditeur de produit (SCRUM-78 / F30), avec comparaison avant / après.
 * Rédiger part de la description saisie (quelques mots) ou, à défaut, du titre.
 */
export default function ProductAiText({ title, description, category, onUse }) {
  const [loading, setLoading] = useState(null) // 'draft' | 'rephrase'
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const notes = description.trim() || title.trim()

  async function generate(action) {
    setLoading(action)
    setError(null)
    try {
      const data = await generateProductText({ text: action === 'rephrase' ? description.trim() : notes, action, category: category ?? null })
      // Rien à comparer quand la description était vide (rédaction à partir du titre).
      setResult(description.trim() ? data : { ...data, before: null })
    } catch (err) {
      setError(err.response?.data?.message ?? err.userMessage ?? "Le texte n'a pas pu être généré.")
    } finally {
      setLoading(null)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-secondary" disabled={loading !== null || notes.length < MIN_LENGTH} onClick={() => generate('draft')}>
          {loading === 'draft' ? 'Rédaction…' : '✦ Rédiger avec l’IA'}
        </button>
        <button type="button" className="btn-secondary" disabled={loading !== null || description.trim().length < MIN_LENGTH} onClick={() => generate('rephrase')}>
          {loading === 'rephrase' ? 'Reformulation…' : '✦ Reformuler'}
        </button>
        <span className="text-xs text-muted">Les suggestions IA restent modifiables.</span>
      </div>
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <AiSuggestion
        result={result}
        onDismiss={() => setResult(null)}
        onUse={(text) => {
          onUse(text)
          setResult(null)
        }}
      />
    </div>
  )
}
