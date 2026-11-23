import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchQuoteSummary, generateQuoteSummary, updateQuoteSummary } from '@/api/quoteSummary'
import { formatRelativeDate } from '@/utils/relativeDate'

const MAX_LENGTH = 1500

function Points({ title, items, className }) {
  if (!items.length) return null
  return (
    <div className="mt-2">
      <p className={`text-xs font-semibold ${className}`}>{title}</p>
      <ul className="mt-0.5 list-disc pl-4 text-sm text-ink">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Résumé automatique des devis (SCRUM-119 / F25) : aide à comparer, sans désigner de gagnant.
 * Généré à l'ouverture de la page s'il manque ou si les devis ont changé. Une panne de l'IA
 * n'empêche jamais de comparer : la carte disparaît ou propose de réessayer.
 */
export default function QuoteSummaryCard({ tenderId, quotes }) {
  const [state, setState] = useState(null) // { can_generate, summary }
  const [status, setStatus] = useState('loading') // loading | generating | ready | failed
  const [error, setError] = useState(null)
  const [draft, setDraft] = useState(null) // texte en cours de modification
  const [saving, setSaving] = useState(false)
  const latest = useRef(0)

  const generate = useCallback(
    async ({ force = false } = {}) => {
      const request = ++latest.current
      setStatus('generating')
      setError(null)
      try {
        const result = await generateQuoteSummary(tenderId, { force })
        if (request !== latest.current) return
        setState(result)
        setStatus('ready')
      } catch (err) {
        if (request !== latest.current) return
        setError(err.response?.data?.message ?? err.userMessage ?? "Le résumé n'a pas pu être généré.")
        setStatus('failed')
      }
    },
    [tenderId],
  )

  useEffect(() => {
    const request = ++latest.current
    setStatus('loading')
    setState(null)
    setDraft(null)
    fetchQuoteSummary(tenderId)
      .then((result) => {
        if (request !== latest.current) return
        setState(result)
        if (result.can_generate && (!result.summary || result.summary.stale)) generate()
        else setStatus('ready')
      })
      .catch(() => request === latest.current && setStatus('hidden'))
    return () => {
      latest.current++
    }
  }, [generate, tenderId])

  async function save(changes) {
    setSaving(true)
    setError(null)
    try {
      setState(await updateQuoteSummary(tenderId, changes))
      setDraft(null)
    } catch (err) {
      setError(err.fieldErrors?.summary?.[0] ?? err.userMessage ?? "La modification n'a pas été enregistrée.")
    } finally {
      setSaving(false)
    }
  }

  const summary = state?.summary
  const busy = status === 'generating'

  if (status === 'loading' || status === 'hidden') return null
  if (!summary && !busy && status !== 'failed') return null

  const nameOf = (quoteId) => quotes.find((quote) => quote.id === quoteId)?.supplier?.company_name
  const analysed = summary?.quotes.filter((item) => nameOf(item.quote_id)) ?? []
  const editing = draft !== null

  return (
    <section aria-label="Résumé des devis" aria-busy={busy} className="mb-6 rounded-xl border border-info-soft bg-info-soft/40 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold text-ink">Résumé des devis</h2>
        {summary && (
          <span className="rounded-full bg-info-soft px-2.5 py-0.5 text-xs font-medium text-info">
            {summary.simulated ? 'Mode simulé, sans IA' : 'Généré par IA'}
          </span>
        )}
        {summary?.edited && <span className="rounded-full bg-page px-2.5 py-0.5 text-xs text-muted">Modifié par vous</span>}
        {summary?.accepted && <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs text-success">Utile</span>}
      </div>

      {busy && (
        <p role="status" className="mt-3 text-sm text-muted">
          {summary ? 'Les devis ont changé ou une mise à jour est demandée : nouveau résumé en cours…' : 'Résumé en cours…'}
        </p>
      )}

      {summary && !editing && <p className="mt-3 text-sm whitespace-pre-line text-ink">{summary.text}</p>}

      {editing && (
        <div className="mt-3">
          <label htmlFor="summary-text" className="sr-only">
            Texte du résumé
          </label>
          <textarea id="summary-text" rows={4} maxLength={MAX_LENGTH} className="input" value={draft} onChange={(event) => setDraft(event.target.value)} />
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="btn-primary" disabled={saving || draft.trim() === ''} onClick={() => save({ summary: draft.trim() })}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button type="button" className="btn-secondary" disabled={saving} onClick={() => setDraft(null)}>
              Annuler
            </button>
            {summary.edited && (
              <button type="button" className="btn-ghost" disabled={saving} onClick={() => save({ summary: summary.original_text })}>
                Rétablir l'original
              </button>
            )}
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}

      {analysed.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-brand-600">Points par devis</summary>
          <ul className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {analysed.map((item) => (
              <li key={item.quote_id} className="rounded-lg bg-surface p-4">
                <p className="text-sm font-semibold text-ink">{nameOf(item.quote_id)}</p>
                <Points title="Points forts" items={item.strengths} className="text-success" />
                <Points title="Points d'attention" items={item.concerns} className="text-accent" />
                <Points title="Questions à poser" items={item.questions} className="text-info" />
                {!item.strengths.length && !item.concerns.length && !item.questions.length && (
                  <p className="mt-2 text-sm text-muted">Rien de particulier à signaler.</p>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
        <span>
          Aide à la comparaison : la décision vous appartient.
          {summary && ` ${formatRelativeDate(summary.created_at)}.`}
        </span>
        <span className="flex flex-wrap gap-3 sm:ml-auto">
          {summary && !editing && !busy && (
            <>
              <button type="button" className="font-medium text-brand-600 hover:underline" onClick={() => setDraft(summary.text)}>
                Modifier
              </button>
              <button
                type="button"
                aria-pressed={summary.accepted}
                className="font-medium text-brand-600 hover:underline"
                disabled={saving}
                onClick={() => save({ accepted: !summary.accepted })}
              >
                {summary.accepted ? 'Plus utile' : 'Ce résumé est utile'}
              </button>
            </>
          )}
          {(state?.can_generate || status === 'failed') && !editing && (
            <button
              type="button"
              className="font-medium text-brand-600 hover:underline disabled:opacity-60"
              disabled={busy}
              onClick={() => generate({ force: status !== 'failed' })}
            >
              {status === 'failed' ? 'Réessayer' : 'Régénérer'}
            </button>
          )}
        </span>
      </div>
    </section>
  )
}
