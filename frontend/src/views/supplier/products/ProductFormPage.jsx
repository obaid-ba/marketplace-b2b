import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { fetchCategories } from '@/api/categories'
import {
  createSupplierProduct,
  deleteProductImage,
  fetchSupplierProduct,
  reorderProductImages,
  updateSupplierProduct,
  uploadProductImages,
} from '@/api/supplierProducts'
import { fetchSupplierProfile } from '@/api/supplierProfile'
import ProductCard from '@/components/ProductCard'
import { PATHS, supplierProductEditPath } from '@/router/paths'
import ProductImagesField from './ProductImagesField'

/**
 * Ajouter / modifier un produit ou un service (SCRUM-33, maquette F3).
 * « Enregistrer le brouillon » ou « Publier » ; un produit retiré par l'administrateur reste retiré.
 * Les fonctions IA (rédaction S6, estimation de prix S7) et la mise en avant ne sont pas encore disponibles.
 */

export const UNITS = [
  'pièce', 'lot de 10', 'lot de 100', 'unité', 'carton', 'palette', 'sac', 'kg', 'tonne', 'litre',
  'mètre', 'm²', 'rouleau', 'heure', 'jour', 'mois', 'forfait',
]

const EMPTY_FORM = {
  type: 'product',
  title: '',
  category_id: '',
  description: '',
  price: '',
  unit: 'pièce',
  stock: '',
  availability_days: '',
}

const STATUS_LABELS = { draft: 'Brouillon', published: 'Publié', withdrawn: 'Retiré' }

function formFromProduct(product) {
  return {
    type: product.type,
    title: product.title ?? '',
    category_id: product.category_id ? String(product.category_id) : '',
    description: product.description ?? '',
    price: product.price ?? '',
    unit: product.unit ?? 'pièce',
    stock: product.stock ?? '',
    availability_days: product.availability_days ?? '',
  }
}

const imagesFromProduct = (product) =>
  (product.images ?? []).map((image) => ({ key: `remote-${image.id}`, id: image.id, url: image.url }))

function toPayload(form, status) {
  const number = (value) => (value === '' || value === null ? null : Number(value))
  return {
    type: form.type,
    title: form.title,
    category_id: number(form.category_id),
    description: form.description,
    price: number(form.price),
    unit: form.unit,
    stock: form.type === 'service' ? null : number(form.stock),
    availability_days: number(form.availability_days),
    status,
  }
}

/** Premier message de chaque champ ; les erreurs « images.0 » sont regroupées sous « images ». */
function flattenErrors(errors = {}) {
  const result = {}
  for (const [key, messages] of Object.entries(errors)) {
    const field = key.startsWith('images') ? 'images' : key
    result[field] ??= Array.isArray(messages) ? messages[0] : messages
  }
  return result
}

const inputClass =
  'w-full rounded-lg border border-line bg-surface px-3.5 py-3 text-sm text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-page disabled:text-muted'

function Field({ label, htmlFor, error, children, className = '' }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      {children}
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

function Card({ title, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-line bg-surface p-5 sm:p-6 ${className}`}>
      {title && <h2 className="mb-4 text-lg font-semibold text-ink">{title}</h2>}
      {children}
    </section>
  )
}

export default function ProductFormPage() {
  const { productId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const isEdit = Boolean(productId)

  const [product, setProduct] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [images, setImages] = useState([])
  const [removedImageIds, setRemovedImageIds] = useState([])
  const [categories, setCategories] = useState([])
  const [supplier, setSupplier] = useState(null)
  const [loading, setLoading] = useState(isEdit)
  const [loadError, setLoadError] = useState(null)
  const [saving, setSaving] = useState(null) // 'draft' | 'published' | null
  const [errors, setErrors] = useState({})
  // Message transmis après la création (la page est rechargée sur l'adresse de modification).
  const [notice, setNotice] = useState(location.state?.notice ?? null)

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => setCategories([]))
    fetchSupplierProfile().then(setSupplier).catch(() => setSupplier(null))
  }, [])

  useEffect(() => {
    if (!isEdit) return
    let active = true
    setLoading(true)
    fetchSupplierProduct(productId)
      .then((data) => {
        if (!active) return
        setProduct(data)
        setForm(formFromProduct(data))
        setImages(imagesFromProduct(data))
        setRemovedImageIds([])
      })
      .catch((error) => active && setLoadError(error.userMessage ?? 'Produit introuvable.'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [isEdit, productId])

  const status = product?.status ?? 'draft'
  const withdrawn = status === 'withdrawn'

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  function changeImages(next) {
    const keptIds = new Set(next.filter((item) => item.id).map((item) => item.id))
    const removed = images.filter((item) => item.id && !keptIds.has(item.id)).map((item) => item.id)
    if (removed.length) setRemovedImageIds((ids) => [...new Set([...ids, ...removed])])
    setImages(next)
    setErrors((current) => ({ ...current, images: undefined }))
  }

  /**
   * Enregistre dans l'ordre : produit (brouillon s'il est nouveau) → nouvelles photos → suppressions →
   * ordre des photos → champs et statut demandé. La publication est vérifiée en dernier par l'API,
   * une fois les photos enregistrées.
   */
  async function save(target) {
    setSaving(target)
    setErrors({})
    setNotice(null)

    let current = product
    let resultNotice = null
    try {
      if (!current) {
        current = (await createSupplierProduct(toPayload(form, 'draft'))).product
        setProduct(current)
      }

      const localItems = images.filter((item) => item.file)
      if (localItems.length) {
        current = (await uploadProductImages(current.id, localItems.map((item) => item.file))).product
      }
      // Les nouvelles photos sont ajoutées à la fin, dans l'ordre d'envoi.
      const newIds = current.images.slice(-localItems.length || current.images.length).map((image) => image.id)
      const idFor = new Map(localItems.map((item, index) => [item.key, newIds[index]]))

      for (const imageId of removedImageIds) {
        current = (await deleteProductImage(current.id, imageId)).product
      }
      setRemovedImageIds([])

      const desired = images.map((item) => item.id ?? idFor.get(item.key)).filter(Boolean)
      const actual = current.images.map((image) => image.id)
      if (desired.length && desired.join() !== actual.join()) {
        current = (await reorderProductImages(current.id, desired)).product
      }

      const finalStatus = current.status === 'withdrawn' ? 'withdrawn' : target
      const result = await updateSupplierProduct(current.id, toPayload(form, finalStatus))
      current = result.product
      resultNotice = { type: 'success', text: result.message }
    } catch (error) {
      setErrors(flattenErrors(error.fieldErrors ?? error?.response?.data?.errors))
      resultNotice = { type: 'error', text: error.userMessage ?? 'L’enregistrement a échoué.' }
    } finally {
      setNotice(resultNotice)
      if (current) {
        setProduct(current)
        setImages(imagesFromProduct(current))
        if (!isEdit) navigate(supplierProductEditPath(current.id), { replace: true, state: { notice: resultNotice } })
      }
      setSaving(null)
    }
  }

  const preview = useMemo(
    () => ({
      id: product?.id ?? 0,
      title: form.title,
      price: form.price === '' ? 0 : Number(form.price),
      unit: form.unit,
      main_image_url: images[0]?.url ?? null,
      supplier: {
        company_name: supplier?.company_name,
        region: supplier?.region?.name,
        rating_avg: supplier?.rating_avg,
      },
    }),
    [product?.id, form.title, form.price, form.unit, images, supplier],
  )

  if (loading) {
    return <div className="h-96 animate-pulse rounded-xl bg-surface" aria-busy="true" aria-label="Chargement du produit" />
  }

  if (loadError) {
    return (
      <Card>
        <p role="alert" className="text-sm text-danger">
          {loadError}
        </p>
        <Link to={PATHS.supplierProducts} className="btn-secondary mt-4">
          Retour à mes produits
        </Link>
      </Card>
    )
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        save('published')
      }}
      className="space-y-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-ink sm:text-[28px]">
            {isEdit ? 'Modifier le produit' : 'Ajouter un produit'}
          </h1>
          <p className="mt-1 truncate text-sm text-muted">
            {isEdit ? product?.title : 'Votre offre apparaîtra dans le catalogue une fois publiée.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="btn-secondary px-5 py-2.5 font-semibold"
            disabled={saving !== null}
            onClick={() => save('draft')}
          >
            {saving === 'draft' ? 'Enregistrement…' : withdrawn ? 'Enregistrer les modifications' : 'Enregistrer le brouillon'}
          </button>
          <button
            type="submit"
            className="btn-primary px-5 py-2.5 font-semibold"
            disabled={saving !== null || withdrawn}
            title={withdrawn ? 'Un produit retiré par l’administrateur ne peut pas être republié' : undefined}
          >
            {saving === 'published' ? 'Publication…' : 'Publier'}
          </button>
        </div>
      </div>

      {notice && (
        <p
          role={notice.type === 'error' ? 'alert' : 'status'}
          className={`rounded-lg px-4 py-3 text-sm ${
            notice.type === 'error' ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success'
          }`}
        >
          {notice.text}
        </p>
      )}

      {withdrawn && (
        <div role="note" className="rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
          <p className="font-semibold">Produit retiré du catalogue par l’administrateur</p>
          {product.withdrawal_reason && <p className="mt-1">Motif : {product.withdrawal_reason}</p>}
        </div>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_370px]">
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-ink">Informations générales</h2>

          <div role="radiogroup" aria-label="Type d’offre" className="mb-5 inline-flex rounded-lg bg-page p-1">
            {[
              { value: 'product', label: 'Produit' },
              { value: 'service', label: 'Service' },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={form.type === option.value}
                onClick={() => update('type', option.value)}
                className={`rounded-md px-5 py-2 text-sm font-medium transition ${
                  form.type === option.value ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <Field label="Titre" htmlFor="product-title" error={errors.title}>
              <input
                id="product-title"
                className={inputClass}
                value={form.title}
                maxLength={150}
                onChange={(event) => update('title', event.target.value)}
              />
            </Field>

            <Field label="Catégorie" htmlFor="product-category" error={errors.category_id}>
              <select
                id="product-category"
                className={inputClass}
                value={form.category_id}
                onChange={(event) => update('category_id', event.target.value)}
              >
                <option value="">Choisir une catégorie</option>
                {categories.map((root) => (
                  <optgroup key={root.id} label={root.name}>
                    <option value={root.id}>{root.name} (général)</option>
                    {root.children.map((child) => (
                      <option key={child.id} value={child.id}>
                        {child.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Field>

            <Field label="Description" htmlFor="product-description" error={errors.description}>
              <textarea
                id="product-description"
                rows={5}
                maxLength={5000}
                className={`${inputClass} resize-y`}
                value={form.description}
                onChange={(event) => update('description', event.target.value)}
              />
            </Field>

            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn-secondary" disabled title="Bientôt disponible">
                ✦ Rédiger avec l’IA
              </button>
              <button type="button" className="btn-secondary" disabled title="Bientôt disponible">
                ✦ Reformuler
              </button>
              <span className="text-xs text-muted">Les suggestions IA restent modifiables.</span>
            </div>
          </div>

          <h2 className="mt-8 mb-4 text-lg font-semibold text-ink">Prix et disponibilité</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prix (TND)" htmlFor="product-price" error={errors.price}>
              <input
                id="product-price"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                className={inputClass}
                value={form.price}
                onChange={(event) => update('price', event.target.value)}
              />
            </Field>
            <Field label="Unité" htmlFor="product-unit" error={errors.unit}>
              <select
                id="product-unit"
                className={inputClass}
                value={form.unit}
                onChange={(event) => update('unit', event.target.value)}
              >
                {(UNITS.includes(form.unit) ? UNITS : [form.unit, ...UNITS]).map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </Field>
            {form.type === 'product' && (
              <Field label="Stock" htmlFor="product-stock" error={errors.stock}>
                <input
                  id="product-stock"
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  className={inputClass}
                  value={form.stock}
                  onChange={(event) => update('stock', event.target.value)}
                />
              </Field>
            )}
            <Field label="Délai de disponibilité (jours)" htmlFor="product-delay" error={errors.availability_days}>
              <input
                id="product-delay"
                type="number"
                min="1"
                max="365"
                step="1"
                inputMode="numeric"
                className={inputClass}
                value={form.availability_days}
                onChange={(event) => update('availability_days', event.target.value)}
              />
            </Field>
          </div>

          <h2 className="mt-8 mb-4 text-lg font-semibold text-ink">Images</h2>
          <ProductImagesField items={images} onChange={changeImages} error={errors.images} />
        </Card>

        <div className="space-y-6">
          <Card title="Publication">
            <div role="group" aria-label="Statut" className="inline-flex rounded-lg bg-page p-1">
              {['draft', 'published', 'withdrawn'].map((value) => (
                <span
                  key={value}
                  aria-current={status === value ? 'true' : undefined}
                  className={`rounded-md px-4 py-1.5 text-sm ${
                    status === value ? 'bg-surface font-semibold text-ink shadow-sm' : 'text-muted'
                  }`}
                >
                  {STATUS_LABELS[value]}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">
              Utilisez « Enregistrer le brouillon » ou « Publier ». Seul l’administrateur peut retirer un produit.
            </p>
            <div className="mt-4">
              <Field label="Mis en avant jusqu’au" htmlFor="product-featured">
                <input
                  id="product-featured"
                  className={inputClass}
                  disabled
                  title="Bientôt disponible"
                  value={product?.featured_until ? new Date(product.featured_until).toLocaleDateString('fr-FR', { dateStyle: 'long' }) : 'Bientôt disponible'}
                  readOnly
                />
              </Field>
            </div>
          </Card>

          {/* Estimation de prix IA : sprint 7, masquée en attendant. */}

          <Card title="Aperçu dans le catalogue">
            <ProductCard product={preview} linkable={false} />
          </Card>
        </div>
      </div>
    </form>
  )
}
