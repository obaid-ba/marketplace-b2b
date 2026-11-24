import { useState } from 'react'
import { generateProductText } from '@/api/ai'
import AiSuggestion from '@/components/AiSuggestion'
import PageHeader from '@/components/PageHeader'

const ACTIONS = [
  { value: 'draft', label: 'Rédiger une description' },
  { value: 'rephrase', label: 'Reformuler un texte existant' },
]

/**
 * Assistant IA du fournisseur (SCRUM-77 / SCRUM-78 / F30) : rédaction et
 * reformulation de la description d'un produit. Le texte reste modifiable.
 */
export default function SupplierAiPage() {
  const [text, setText] = useState('')
  const [action, setAction] = useState('draft')
  const [category, setCategory] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function submit(event) {
    event.preventDefault()
    if (text.trim().length < 3) {
      setError('Saisissez au moins quelques mots sur votre produit.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      setResult(
        await generateProductText({
          text: text.trim(),
          action,
          category: category.trim() || null,
        }),
      )
    } catch (requestError) {
      setError(requestError.userMessage ?? 'La génération a échoué.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assistant IA"
        subtitle="Obtenez une description produit claire et professionnelle. Relisez et adaptez le texte avant publication."
      />

      <section className="card" aria-labelledby="product-text-title">
        <h2 id="product-text-title" className="text-base font-semibold text-ink">
          Description produit
        </h2>

        <form onSubmit={submit} className="mt-4 space-y-3" noValidate>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink">Votre texte ou vos notes</span>
            <textarea
              rows="4"
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={5000}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
              placeholder="Ex. perceuse sans fil 18V, deux batteries, mandrin 13 mm"
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-ink">Action</span>
              <select
                value={action}
                onChange={(event) => setAction(event.target.value)}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
              >
                {ACTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
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
          </div>

          {error && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-sm text-rose-800">
              {error}
            </p>
          )}

          <div className="flex justify-end">
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Génération…' : 'Générer le texte'}
            </button>
          </div>
        </form>

        <AiSuggestion result={result} />
      </section>
    </div>
  )
}
