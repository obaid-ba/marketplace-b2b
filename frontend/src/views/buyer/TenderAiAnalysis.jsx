import { useState } from 'react'
import { analyzeTender } from '@/api/tenders'
import RelevanceScoreBadge from '@/components/RelevanceScoreBadge'

const MIN_TITLE = 3
const MIN_DESCRIPTION = 20

/**
 * Analyse IA de la demande dans « Publier une demande » (SCRUM-81 / F31) : catégorie proposée (modifiable),
 * mots-clés détectés et fournisseurs suggérés à cocher. L'IA propose, le porteur décide ; sans elle,
 * la publication reste possible.
 *
 * Props : title, description, categoryId, regionId ; categoryLabel(id) pour afficher un nom ;
 * onCategory(id) pour appliquer la catégorie proposée ; onChange({ interactionId, supplierIds }).
 */
export default function TenderAiAnalysis({ title, description, categoryId, regionId, categoryLabel, onCategory, onChange }) {
  const [result, setResult] = useState(null)
  const [selected, setSelected] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const ready = title.trim().length >= MIN_TITLE && description.trim().length >= MIN_DESCRIPTION

  async function analyze() {
    setLoading(true)
    setError(null)
    try {
      const data = await analyzeTender({ title, description, category_id: categoryId, region_id: regionId })
      setResult(data)
      setSelected([])
      onChange({ interactionId: data.interaction_id, supplierIds: [] })
      // Aucune catégorie choisie : la proposition est appliquée, toujours modifiable dans la liste.
      if (!categoryId && data.category) onCategory(String(data.category.id))
    } catch (err) {
      setError(err.response?.data?.message ?? err.userMessage ?? 'L’analyse n’a pas pu être faite.')
    } finally {
      setLoading(false)
    }
  }

  function toggle(id) {
    const next = selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id]
    setSelected(next)
    onChange({ interactionId: result.interaction_id, supplierIds: next })
  }

  const proposed = result?.category
  const differs = proposed && String(proposed.id) !== String(categoryId)

  return (
    <section aria-label="Analyse de la demande par l’IA" className="rounded-xl border border-brand-100 bg-brand-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium text-ink">✦ Catégorie et fournisseurs suggérés</p>
          <p className="text-xs text-muted">
            L’IA lit votre titre et votre description, propose une catégorie et des fournisseurs à inviter.
          </p>
        </div>
        <button type="button" className="btn-secondary" onClick={analyze} disabled={!ready || loading}>
          {loading ? 'Analyse…' : result ? 'Relancer l’analyse' : 'Analyser ma demande'}
        </button>
      </div>
      {!ready && !result && (
        <p className="mt-2 text-xs text-muted">Saisissez un titre et au moins {MIN_DESCRIPTION} caractères de description.</p>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-4 space-y-4">
          <p className="text-xs text-muted">{result.label}</p>

          <div>
            <p className="text-sm font-medium text-ink">Catégorie proposée</p>
            {proposed ? (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full bg-info-soft px-3 py-1 font-medium text-info">{categoryLabel(proposed.id) ?? proposed.name}</span>
                {differs ? (
                  <button type="button" className="font-medium text-brand-600 hover:underline" onClick={() => onCategory(String(proposed.id))}>
                    Utiliser cette catégorie
                  </button>
                ) : (
                  <span className="text-muted">Appliquée — vous pouvez la changer dans la liste « Catégorie ».</span>
                )}
              </div>
            ) : (
              <p className="mt-1 text-sm text-muted">Aucune catégorie reconnue : choisissez-la dans la liste.</p>
            )}
          </div>

          {result.keywords.length > 0 && (
            <div>
              <p className="text-sm font-medium text-ink">Mots-clés détectés</p>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {result.keywords.map((keyword) => (
                  <li key={keyword} className="rounded-full bg-surface px-2.5 py-0.5 text-xs text-ink ring-1 ring-line">
                    {keyword}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <fieldset>
            <legend className="text-sm font-medium text-ink">Fournisseurs suggérés</legend>
            {result.suggested_suppliers.length === 0 ? (
              <p className="mt-1 text-sm text-muted">
                Aucun fournisseur à suggérer pour l’instant. La demande sera tout de même diffusée aux fournisseurs de la catégorie.
              </p>
            ) : (
              <>
                <p className="mt-1 text-xs text-muted">
                  Cochez ceux que vous voulez inviter : ils seront notifiés à la publication.
                </p>
                <ul className="mt-2 space-y-2">
                  {result.suggested_suppliers.map((supplier) => (
                    <li key={supplier.id}>
                      <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-surface p-3 ring-1 ring-line has-[:checked]:ring-brand-600">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={selected.includes(supplier.id)}
                          onChange={() => toggle(supplier.id)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-ink">{supplier.company_name}</span>
                            <RelevanceScoreBadge score={supplier.score} />
                          </span>
                          <span className="block text-xs text-muted">
                            {[supplier.region, ...supplier.reasons].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </fieldset>
        </div>
      )}
    </section>
  )
}
