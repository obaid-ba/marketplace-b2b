import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { createTender, fetchTenderReferences } from '@/api/tenders'
import PageHeader from '@/components/PageHeader'
import { buyerTenderPath, PATHS } from '@/router/paths'

const MAX_FILES = 5
const MAX_FILE_SIZE = 5 * 1024 * 1024

const EMPTY_FORM = {
  title: '',
  description: '',
  category_id: '',
  region_id: '',
  budget: '',
  desired_deadline: '',
}

/** Regroupe les catégories par catégorie principale pour la liste déroulante. */
function categoryOptions(categories) {
  const parents = categories.filter((category) => !category.parent_id)
  const options = []

  parents.forEach((parent) => {
    options.push({ id: parent.id, label: parent.name })
    categories
      .filter((category) => category.parent_id === parent.id)
      .forEach((child) => options.push({ id: child.id, label: `— ${child.name}` }))
  })

  // Catégories orphelines (parent absent de la liste) : affichées à la fin.
  categories
    .filter((category) => category.parent_id && !parents.some((parent) => parent.id === category.parent_id))
    .forEach((category) => options.push({ id: category.id, label: category.name }))

  return options
}

/**
 * Publication d'une demande (SCRUM-41 / F11) : le formulaire reprend les champs
 * de l'API (titre, description, catégorie, région, budget, date limite, pièces jointes).
 */
export default function NewTenderPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY_FORM)
  const [files, setFiles] = useState([])
  const [references, setReferences] = useState({ categories: [], regions: [] })
  const [referencesLoading, setReferencesLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

  useEffect(() => {
    let active = true

    fetchTenderReferences()
      .then((data) => {
        if (active) setReferences(data)
      })
      .catch(() => {
        if (active) setError('Impossible de charger les catégories et les régions.')
      })
      .finally(() => {
        if (active) setReferencesLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const categories = useMemo(() => categoryOptions(references.categories ?? []), [references.categories])

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
  }

  function addFiles(event) {
    const selected = Array.from(event.target.files ?? [])
    event.target.value = ''

    const next = [...files]
    for (const file of selected) {
      if (file.size > MAX_FILE_SIZE) {
        setError(`« ${file.name} » dépasse 5 Mo.`)
        continue
      }
      if (next.length >= MAX_FILES) {
        setError(`Vous pouvez joindre au maximum ${MAX_FILES} fichiers.`)
        break
      }
      next.push(file)
    }

    setFiles(next)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setFieldErrors({})

    try {
      const tender = await createTender(
        {
          title: form.title,
          description: form.description,
          category_id: form.category_id,
          region_id: form.region_id || null,
          budget: form.budget === '' ? null : form.budget,
          desired_deadline: form.desired_deadline || null,
        },
        files,
      )

      navigate(buyerTenderPath(tender.id), {
        state: { notice: 'Votre demande est publiée. Les fournisseurs correspondants sont notifiés.' },
      })
    } catch (failure) {
      setError(failure.userMessage ?? 'La demande n’a pas pu être publiée.')
      setFieldErrors(failure.fieldErrors ?? {})
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Publier une demande"
        subtitle="Décrivez votre besoin : les fournisseurs validés de la catégorie et de la région seront notifiés."
        actions={
          <Link to={PATHS.buyerTenders} className="btn-secondary">
            Retour à mes demandes
          </Link>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg border border-danger-soft bg-danger-soft/50 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card max-w-3xl space-y-5">
        <div>
          <label htmlFor="title" className="mb-1 block text-sm font-medium text-ink">
            Titre de la demande *
          </label>
          <input
            id="title"
            className="input"
            value={form.title}
            onChange={(event) => update('title', event.target.value)}
            placeholder="Ex. Cartons d’emballage sur mesure"
            maxLength={150}
            required
          />
          {fieldErrors.title && <p className="mt-1 text-sm text-danger">{fieldErrors.title[0]}</p>}
        </div>

        <div>
          <label htmlFor="description" className="mb-1 block text-sm font-medium text-ink">
            Description du besoin *
          </label>
          <textarea
            id="description"
            className="input min-h-32"
            value={form.description}
            onChange={(event) => update('description', event.target.value)}
            placeholder="Quantités, qualité attendue, contraintes de livraison…"
            maxLength={5000}
            required
          />
          <p className="mt-1 text-xs text-muted">{form.description.length} / 5000 caractères</p>
          {fieldErrors.description && <p className="mt-1 text-sm text-danger">{fieldErrors.description[0]}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="category_id" className="mb-1 block text-sm font-medium text-ink">
              Catégorie *
            </label>
            <select
              id="category_id"
              className="input"
              value={form.category_id}
              onChange={(event) => update('category_id', event.target.value)}
              disabled={referencesLoading}
              required
            >
              <option value="">
                {referencesLoading ? 'Chargement…' : 'Choisir une catégorie'}
              </option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
            {fieldErrors.category_id && <p className="mt-1 text-sm text-danger">{fieldErrors.category_id[0]}</p>}
          </div>

          <div>
            <label htmlFor="region_id" className="mb-1 block text-sm font-medium text-ink">
              Région
            </label>
            <select
              id="region_id"
              className="input"
              value={form.region_id}
              onChange={(event) => update('region_id', event.target.value)}
              disabled={referencesLoading}
            >
              <option value="">Toute la Tunisie</option>
              {(references.regions ?? []).map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
            </select>
            {fieldErrors.region_id && <p className="mt-1 text-sm text-danger">{fieldErrors.region_id[0]}</p>}
          </div>

          <div>
            <label htmlFor="budget" className="mb-1 block text-sm font-medium text-ink">
              Budget indicatif (TND)
            </label>
            <input
              id="budget"
              type="number"
              min="0"
              step="0.01"
              className="input"
              value={form.budget}
              onChange={(event) => update('budget', event.target.value)}
              placeholder="Ex. 4500"
            />
            {fieldErrors.budget && <p className="mt-1 text-sm text-danger">{fieldErrors.budget[0]}</p>}
          </div>

          <div>
            <label htmlFor="desired_deadline" className="mb-1 block text-sm font-medium text-ink">
              Date limite souhaitée
            </label>
            <input
              id="desired_deadline"
              type="date"
              className="input"
              value={form.desired_deadline}
              onChange={(event) => update('desired_deadline', event.target.value)}
              min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
            />
            {fieldErrors.desired_deadline && (
              <p className="mt-1 text-sm text-danger">{fieldErrors.desired_deadline[0]}</p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="attachments" className="mb-1 block text-sm font-medium text-ink">
            Pièces jointes (cahier des charges, photos…)
          </label>
          <input
            id="attachments"
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={addFiles}
            className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-600"
          />
          <p className="mt-1 text-xs text-muted">PDF, JPG, PNG, DOC ou DOCX — 5 fichiers maximum, 5 Mo par fichier.</p>

          {files.length > 0 && (
            <ul className="mt-2 space-y-1">
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`} className="flex items-center justify-between rounded-lg bg-page px-3 py-1.5 text-sm">
                  <span className="truncate text-ink">{file.name}</span>
                  <button
                    type="button"
                    className="ml-3 text-xs font-medium text-danger hover:underline"
                    onClick={() => setFiles((current) => current.filter((_, position) => position !== index))}
                  >
                    Retirer
                  </button>
                </li>
              ))}
            </ul>
          )}
          {fieldErrors.attachments && <p className="mt-1 text-sm text-danger">{fieldErrors.attachments[0]}</p>}
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-line pt-5">
          <Link to={PATHS.buyerTenders} className="btn-secondary">
            Annuler
          </Link>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Publication…' : 'Publier la demande'}
          </button>
        </div>
      </form>
    </>
  )
}
