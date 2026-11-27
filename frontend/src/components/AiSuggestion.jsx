import { useState } from 'react'
import { acceptAiSuggestion } from '@/api/ai'

/**
 * Suggestion générée par l'IA (SCRUM-124 / F30).
 *
 * Le texte reste toujours modifiable : l'IA propose, l'utilisateur décide.
 * onUse (formulaires) : « Utiliser ce texte » le place dans le champ ; onDismiss : garder son propre texte.
 * Sans onUse (page Assistant IA), « Marquer comme acceptée » journalise seulement le choix.
 */
export default function AiSuggestion({ result, ...props }) {
  // Une nouvelle suggestion repart de zéro.
  return result ? <Suggestion key={result.interaction_id} result={result} {...props} /> : null
}

function Suggestion({ result, onAccepted, onUse, onDismiss }) {
  const [text, setText] = useState(result.output ?? '')
  const [accepted, setAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function accept() {
    setSubmitting(true)
    setError(null)
    try {
      await acceptAiSuggestion(result.interaction_id, text)
      setAccepted(true)
      onAccepted?.(result)
    } catch (requestError) {
      setError(requestError.userMessage ?? "La suggestion n'a pas pu être enregistrée.")
    } finally {
      setSubmitting(false)
    }
  }

  function use() {
    // Le texte est repris même si l'enregistrement du choix échoue.
    acceptAiSuggestion(result.interaction_id, text).catch(() => {})
    onUse(text)
  }

  return (
    <section aria-label="Suggestion" className="mt-4 space-y-3 rounded-xl border border-brand-100 bg-brand-50/40 p-4">
      <p className="text-xs font-medium tracking-wide text-brand-700 uppercase">
        {result.simulated ? 'Mode simulé, sans IA' : 'Suggestion IA'} — à relire et modifier
      </p>

      <div className={result.before ? 'grid gap-4 md:grid-cols-2' : ''}>
        {result.before && (
          <div className="text-sm">
            <p className="mb-1 font-medium text-ink">Avant</p>
            <p className="max-h-72 overflow-y-auto rounded-lg bg-surface px-3 py-2 whitespace-pre-wrap text-muted">{result.before}</p>
          </div>
        )}
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-ink">{result.before ? 'Après' : 'Texte proposé'}</span>
          <textarea
            rows="8"
            maxLength={5000}
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-sm text-rose-800">
          {error}
        </p>
      )}

      {onUse ? (
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onDismiss}>
            {result.before ? 'Garder mon texte' : 'Fermer'}
          </button>
          <button type="button" className="btn-primary" onClick={use} disabled={text.trim() === ''}>
            Utiliser ce texte
          </button>
        </div>
      ) : accepted ? (
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
    </section>
  )
}
