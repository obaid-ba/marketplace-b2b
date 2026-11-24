import { useEffect, useState } from 'react'
import { acceptAiSuggestion } from '@/api/ai'

/**
 * Suggestion générée par l'IA (SCRUM-124 / F30).
 *
 * Le texte reste toujours modifiable : l'IA propose, l'utilisateur décide.
 * « Marquer comme acceptée » journalise le choix sans publier automatiquement.
 */
export default function AiSuggestion({ result, onAccepted }) {
  const [text, setText] = useState(result?.output ?? '')
  const [accepted, setAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setText(result?.output ?? '')
    setAccepted(false)
    setError(null)
  }, [result])

  if (!result) return null

  async function accept() {
    setSubmitting(true)
    setError(null)
    try {
      await acceptAiSuggestion(result.interaction_id)
      setAccepted(true)
      onAccepted?.(result)
    } catch (requestError) {
      setError(requestError.userMessage ?? "La suggestion n'a pas pu être enregistrée.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-brand-200 bg-brand-50/40 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-brand-700">
        {result.simulated ? 'Mode simulé, sans IA' : 'Suggestion IA'} — à relire et modifier
      </p>

      {result.before !== null && result.before !== undefined && (
        <div className="text-sm">
          <p className="text-xs font-medium text-muted">Texte d'origine</p>
          <p className="mt-1 whitespace-pre-wrap text-muted">{result.before}</p>
        </div>
      )}

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-ink">Texte proposé</span>
        <textarea
          rows="8"
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
        />
      </label>

      {error && (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-sm text-rose-800">
          {error}
        </p>
      )}

      {accepted ? (
        <p role="status" className="text-sm font-medium text-emerald-700">
          Suggestion marquée comme acceptée.
        </p>
      ) : (
        <div className="flex justify-end">
          <button type="button" className="btn btn-secondary" onClick={accept} disabled={submitting}>
            {submitting ? 'Enregistrement…' : 'Marquer comme acceptée'}
          </button>
        </div>
      )}
    </div>
  )
}
