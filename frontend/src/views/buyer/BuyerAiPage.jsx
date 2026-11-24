import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { generateTenderDraft } from '@/api/ai'
import { fetchBuyerTenders } from '@/api/tenders'
import AiSuggestion from '@/components/AiSuggestion'
import PageHeader from '@/components/PageHeader'
import { buyerTenderQuotesPath } from '@/router/paths'

/**
 * Assistant IA du porteur de projet (SCRUM-124 / SCRUM-79 / F30) :
 * brouillon de demande et accès au résumé des devis (page de comparaison).
 */
export default function BuyerAiPage() {
  const [prompt, setPrompt] = useState('')
  const [category, setCategory] = useState('')
  const [region, setRegion] = useState('')
  const [draft, setDraft] = useState(null)
  const [draftLoading, setDraftLoading] = useState(false)
  const [draftError, setDraftError] = useState(null)

  const [tenders, setTenders] = useState([])
  const [tenderId, setTenderId] = useState('')

  useEffect(() => {
    let active = true
    fetchBuyerTenders({ per_page: 50 })
      .then((result) => {
        if (active) setTenders(result?.data ?? [])
      })
      .catch(() => {
        if (active) setTenders([])
      })
    return () => {
      active = false
    }
  }, [])

  async function submitDraft(event) {
    event.preventDefault()
    if (prompt.trim().length < 5) {
      setDraftError('Décrivez votre besoin en quelques mots (5 caractères minimum).')
      return
    }

    setDraftLoading(true)
    setDraftError(null)
    try {
      setDraft(
        await generateTenderDraft({
          prompt: prompt.trim(),
          category: category.trim() || null,
          region: region.trim() || null,
        }),
      )
    } catch (requestError) {
      setDraftError(requestError.userMessage ?? 'La génération a échoué.')
    } finally {
      setDraftLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assistant IA"
        subtitle="Rédigez un brouillon de demande ou comparez les devis reçus. Les suggestions restent modifiables."
      />

      <section className="card" aria-labelledby="tender-draft-title">
        <h2 id="tender-draft-title" className="text-base font-semibold text-ink">
          Brouillon de demande
        </h2>
        <p className="mt-1 text-sm text-muted">
          Décrivez votre besoin : l'assistant propose un texte structuré que vous pourrez relire avant publication.
        </p>

        <form onSubmit={submitDraft} className="mt-4 space-y-3" noValidate>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink">Votre besoin</span>
            <textarea
              rows="3"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              maxLength={5000}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
              placeholder="Ex. fourniture de cartons double cannelure pour expédition de produits fragiles"
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-ink">Catégorie (facultatif)</span>
              <input
                type="text"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                maxLength={100}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-ink">Région (facultatif)</span>
              <input
                type="text"
                value={region}
                onChange={(event) => setRegion(event.target.value)}
                maxLength={100}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
              />
            </label>
          </div>

          {draftError && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-sm text-rose-800">
              {draftError}
            </p>
          )}

          <div className="flex justify-end">
            <button type="submit" className="btn btn-primary" disabled={draftLoading}>
              {draftLoading ? 'Génération…' : 'Générer un brouillon'}
            </button>
          </div>
        </form>

        <AiSuggestion result={draft} />
      </section>

      <section className="card" aria-labelledby="quote-summary-title">
        <h2 id="quote-summary-title" className="text-base font-semibold text-ink">
          Comparer les devis
        </h2>
        <p className="mt-1 text-sm text-muted">
          Le résumé des devis est sur la page de comparaison. Il vous aide à décider, sans choisir à votre place.
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm">
            <span className="mb-1 block font-medium text-ink">Demande</span>
            <select
              value={tenderId}
              onChange={(event) => setTenderId(event.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
            >
              <option value="">Choisir une demande…</option>
              {tenders.map((tender) => (
                <option key={tender.id} value={tender.id}>
                  {tender.title}
                </option>
              ))}
            </select>
          </label>
          {tenderId && (
            <Link to={buyerTenderQuotesPath(tenderId)} className="btn btn-primary">
              Comparer
            </Link>
          )}
        </div>

        {tenders.length === 0 && (
          <p className="mt-2 text-xs text-muted">Publiez une demande pour pouvoir comparer les devis reçus.</p>
        )}
      </section>
    </div>
  )
}
