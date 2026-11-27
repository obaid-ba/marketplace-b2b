import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createCategory,
  deleteCategory,
  fetchAdminCategories,
  moveCategory,
  updateCategory,
} from '@/api/adminCategories'

/**
 * Gestion des catégories et sous-catégories (SCRUM-32, maquette AD5).
 * Liste à gauche (↑ ↓, glisser-déposer, Modifier), panneau d'édition à droite.
 * Le réordonnancement ne se fait qu'entre catégories sœurs (racines entre elles, sous-catégories d'un même parent).
 */

const EMPTY_FORM = { name: '', parent_id: '', position: '' }

const numberFormat = new Intl.NumberFormat('fr-FR')

function productsLabel(count = 0) {
  return `${numberFormat.format(count)} ${count > 1 ? 'produits' : 'produit'}`
}

/** Aplatit l'arbre en lignes affichables, avec le groupe de sœurs de chaque ligne. */
function flatten(tree) {
  const rows = []
  tree.forEach((root, index) => {
    rows.push({ category: root, level: 0, index, siblingsCount: tree.length })
    root.children.forEach((child, childIndex) => {
      rows.push({ category: child, level: 1, index: childIndex, siblingsCount: root.children.length })
    })
  })
  return rows
}

function findCategory(tree, id) {
  for (const root of tree) {
    if (root.id === id) return root
    const child = root.children.find((c) => c.id === id)
    if (child) return child
  }
  return null
}

function formFrom(category) {
  return {
    name: category.name,
    parent_id: category.parent_id === null ? '' : String(category.parent_id),
    position: String(category.position),
  }
}

function errorMessage(error) {
  const errors = error?.response?.data?.errors
  return errors?.category?.[0] ?? error?.userMessage ?? 'Une erreur est survenue. Réessayez.'
}

function GripIcon() {
  return (
    <span aria-hidden="true" className="cursor-grab text-sm text-muted select-none active:cursor-grabbing">
      ⋮⋮
    </span>
  )
}

function Field({ label, htmlFor, error, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

const fieldClass =
  'w-full rounded-lg border border-line bg-surface px-3.5 py-3 text-sm text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-page disabled:text-muted'

function ConfirmDeleteDialog({ category, deleting, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <button type="button" aria-label="Fermer" className="absolute inset-0 bg-ink/40" onClick={onCancel} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-category-title"
        className="relative w-full max-w-md rounded-xl bg-surface p-6 shadow-xl"
      >
        <h2 id="delete-category-title" className="text-lg font-semibold text-ink">
          Supprimer « {category.name} » ?
        </h2>
        <p className="mt-2 text-sm text-muted">
          Cette action est définitive. Une catégorie utilisée par des produits ou des demandes, ou qui contient des
          sous-catégories, ne peut pas être supprimée.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={deleting}>
            Annuler
          </button>
          <button
            type="button"
            className="btn bg-danger font-semibold text-white hover:bg-danger/90"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? 'Suppression…' : 'Supprimer'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CategoryManagementPage() {
  const [tree, setTree] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  // Panneau : null (rien de sélectionné), { mode: 'create' } ou { mode: 'edit', id }
  const [panel, setPanel] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [panelError, setPanelError] = useState(null)

  const [notice, setNotice] = useState(null)
  const [movingId, setMovingId] = useState(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [dragged, setDragged] = useState(null) // { id, parentId }
  const [dropTargetId, setDropTargetId] = useState(null)

  const panelRef = useRef(null)
  const nameInputRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const data = await fetchAdminCategories()
      setTree(data)
      setLoadError(null)
      return data
    } catch (error) {
      setLoadError(error.userMessage ?? 'Impossible de charger les catégories.')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const rows = useMemo(() => flatten(tree), [tree])
  const editedCategory = panel?.mode === 'edit' ? findCategory(tree, panel.id) : null
  const parentOptions = tree.filter((root) => root.id !== editedCategory?.id)
  const hasChildren = (editedCategory?.children?.length ?? 0) > 0

  function openPanel(next, nextForm) {
    setPanel(next)
    setForm(nextForm)
    setFieldErrors({})
    setPanelError(null)
    // Sur mobile, le panneau est sous la liste : on l'amène à l'écran.
    requestAnimationFrame(() => {
      panelRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
      nameInputRef.current?.focus()
    })
  }

  function startCreate() {
    openPanel({ mode: 'create' }, EMPTY_FORM)
  }

  function startEdit(category) {
    openPanel({ mode: 'edit', id: category.id }, formFrom(category))
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setPanelError(null)
    setNotice(null)

    const payload = {
      name: form.name,
      parent_id: form.parent_id === '' ? null : Number(form.parent_id),
      position: form.position === '' ? null : Number(form.position),
    }

    try {
      const result =
        panel.mode === 'create' ? await createCategory(payload) : await updateCategory(panel.id, payload)
      const data = await load()
      const saved = data && findCategory(data, result.category.id)
      if (saved) {
        setPanel({ mode: 'edit', id: saved.id })
        setForm(formFrom(saved))
      }
      setNotice({ type: 'success', text: panel.mode === 'create' ? 'Catégorie créée.' : 'Catégorie enregistrée.' })
    } catch (error) {
      const errors = error?.response?.data?.errors ?? {}
      setFieldErrors(Object.fromEntries(Object.entries(errors).map(([key, messages]) => [key, messages[0]])))
      if (!errors.name && !errors.parent_id && !errors.position) {
        setPanelError(errorMessage(error))
      }
    } finally {
      setSaving(false)
    }
  }

  async function runMove(category, move) {
    setMovingId(category.id)
    setNotice(null)
    try {
      await moveCategory(category.id, move)
      const data = await load()
      // Garde le champ « Position » du panneau à jour si la catégorie déplacée est ouverte.
      if (data && panel?.mode === 'edit') {
        const current = findCategory(data, panel.id)
        if (current) setForm((f) => ({ ...f, position: String(current.position) }))
      }
    } catch (error) {
      setNotice({ type: 'error', text: errorMessage(error) })
    } finally {
      setMovingId(null)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setPanelError(null)
    try {
      const result = await deleteCategory(panel.id)
      setConfirmingDelete(false)
      setPanel(null)
      setForm(EMPTY_FORM)
      await load()
      setNotice({ type: 'success', text: result.message })
    } catch (error) {
      setConfirmingDelete(false)
      setPanelError(errorMessage(error))
    } finally {
      setDeleting(false)
    }
  }

  // --- Glisser-déposer (entre catégories sœurs uniquement) ---

  function canDropOn(category) {
    return dragged && dragged.id !== category.id && dragged.parentId === category.parent_id
  }

  function handleDrop(event, row) {
    event.preventDefault()
    setDropTargetId(null)
    if (!canDropOn(row.category)) return
    const source = findCategory(tree, dragged.id)
    setDragged(null)
    runMove(source, { position: row.index + 1 })
  }

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Chargement des catégories">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-surface" />
        ))}
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="card text-center">
        <p className="text-sm text-danger" role="alert">
          {loadError}
        </p>
        <button
          type="button"
          className="btn-secondary mt-4"
          onClick={() => {
            setLoading(true)
            load()
          }}
        >
          Réessayer
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink sm:text-[28px]">Gestion des catégories</h1>
          <p className="mt-1 text-sm text-muted">Organisez l’arborescence du catalogue (réordonnable)</p>
        </div>
        <button type="button" className="btn-primary px-5 py-2.5 font-semibold" onClick={startCreate}>
          Ajouter une catégorie
        </button>
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

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Arborescence */}
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          {rows.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="font-medium text-ink">Aucune catégorie pour le moment</p>
              <p className="mt-1 text-sm text-muted">Ajoutez la première catégorie du catalogue.</p>
            </div>
          ) : (
            <ul aria-label="Arborescence des catégories">
              {rows.map((row) => {
                const { category, level, index, siblingsCount } = row
                const busy = movingId === category.id
                const selected = editedCategory?.id === category.id
                return (
                  <li
                    key={category.id}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'move'
                      setDragged({ id: category.id, parentId: category.parent_id })
                    }}
                    onDragEnd={() => {
                      setDragged(null)
                      setDropTargetId(null)
                    }}
                    onDragOver={(event) => {
                      if (canDropOn(category)) {
                        event.preventDefault()
                        setDropTargetId(category.id)
                      }
                    }}
                    onDragLeave={() => setDropTargetId((id) => (id === category.id ? null : id))}
                    onDrop={(event) => handleDrop(event, row)}
                    className={`flex items-center gap-2 border-b border-line py-3 pr-3 last:border-b-0 sm:gap-3 sm:pr-4 ${
                      level === 0 ? 'pl-3 sm:pl-4' : 'pl-8 sm:pl-[52px]'
                    } ${selected ? 'bg-brand-50/60' : ''} ${dropTargetId === category.id ? 'bg-brand-50 ring-2 ring-brand-100 ring-inset' : ''} ${
                      dragged?.id === category.id ? 'opacity-50' : ''
                    }`}
                  >
                    <GripIcon />
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm text-ink ${level === 0 ? 'font-semibold' : ''}`}>{category.name}</p>
                      <p className="text-xs text-muted sm:hidden">{productsLabel(category.products_count)}</p>
                    </div>
                    <span className="hidden shrink-0 text-xs text-muted sm:inline">
                      {productsLabel(category.products_count)}
                    </span>
                    <button
                      type="button"
                      className="btn-secondary h-9 w-9 shrink-0 px-0 sm:h-10 sm:w-[54px]"
                      aria-label={`Monter « ${category.name} »`}
                      title="Monter"
                      disabled={index === 0 || busy}
                      onClick={() => runMove(category, { direction: 'up' })}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="btn-secondary h-9 w-9 shrink-0 px-0 sm:h-10 sm:w-[54px]"
                      aria-label={`Descendre « ${category.name} »`}
                      title="Descendre"
                      disabled={index === siblingsCount - 1 || busy}
                      onClick={() => runMove(category, { direction: 'down' })}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="btn-secondary h-9 shrink-0 px-3 font-semibold sm:h-10 sm:px-5"
                      aria-label={`Modifier « ${category.name} »`}
                      onClick={() => startEdit(category)}
                    >
                      Modifier
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Panneau d'édition */}
        <section
          ref={panelRef}
          aria-labelledby="category-panel-title"
          className="rounded-xl border border-line bg-surface p-6 lg:sticky lg:top-24"
        >
          {panel === null ? (
            <>
              <h2 id="category-panel-title" className="text-lg font-semibold text-ink">
                Modifier la catégorie
              </h2>
              <p className="mt-2 text-sm text-muted">
                Choisissez « Modifier » sur une catégorie, ou ajoutez-en une nouvelle.
              </p>
            </>
          ) : (
            <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
              <h2 id="category-panel-title" className="text-lg font-semibold text-ink">
                {panel.mode === 'create' ? 'Nouvelle catégorie' : 'Modifier la catégorie'}
              </h2>

              <Field label="Nom" htmlFor="category-name" error={fieldErrors.name}>
                <input
                  ref={nameInputRef}
                  id="category-name"
                  className={fieldClass}
                  value={form.name}
                  maxLength={100}
                  required
                  onChange={(event) => updateField('name', event.target.value)}
                />
              </Field>

              <Field
                label="Catégorie parente"
                htmlFor="category-parent"
                error={fieldErrors.parent_id}
                hint={
                  hasChildren
                    ? 'Contient des sous-catégories : reste une catégorie principale.'
                    : 'Vide = catégorie principale.'
                }
              >
                <select
                  id="category-parent"
                  className={fieldClass}
                  value={form.parent_id}
                  disabled={hasChildren}
                  onChange={(event) => updateField('parent_id', event.target.value)}
                >
                  <option value="">Aucune (catégorie principale)</option>
                  {parentOptions.map((root) => (
                    <option key={root.id} value={root.id}>
                      {root.name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="Position"
                htmlFor="category-position"
                error={fieldErrors.position}
                hint={panel.mode === 'create' ? 'Vide = à la fin.' : undefined}
              >
                <input
                  id="category-position"
                  type="number"
                  min="1"
                  inputMode="numeric"
                  className={fieldClass}
                  value={form.position}
                  onChange={(event) => updateField('position', event.target.value)}
                />
              </Field>

              {panelError && (
                <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2.5 text-sm text-danger">
                  {panelError}
                </p>
              )}

              <button type="submit" className="btn-primary w-full py-2.5 font-semibold" disabled={saving}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>

              {panel.mode === 'edit' ? (
                <button
                  type="button"
                  className="btn w-full bg-danger py-2.5 font-semibold text-white hover:bg-danger/90"
                  onClick={() => setConfirmingDelete(true)}
                  disabled={saving}
                >
                  Supprimer
                </button>
              ) : (
                <button type="button" className="btn-secondary w-full py-2.5" onClick={() => setPanel(null)}>
                  Annuler
                </button>
              )}
            </form>
          )}
        </section>
      </div>

      {confirmingDelete && editedCategory && (
        <ConfirmDeleteDialog
          category={editedCategory}
          deleting={deleting}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}
