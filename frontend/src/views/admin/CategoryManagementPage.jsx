import { useCallback, useEffect, useState } from 'react'
import {
  createAdminCategory,
  deleteAdminCategory,
  fetchAdminCategories,
  reorderAdminCategories,
  updateAdminCategory,
} from '@/api/adminCategories'

export default function CategoryManagementPage() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [successNotice, setSuccessNotice] = useState(null)

  // Modale création / renommage
  const [modal, setModal] = useState({
    open: false,
    mode: 'create_main', // 'create_main' | 'create_sub' | 'rename'
    category: null,
    parentId: null,
    name: '',
    submitting: false,
    formError: null,
  })

  // Modale suppression
  const [deleteModal, setDeleteModal] = useState({
    open: false,
    category: null,
    deleting: false,
    error: null,
  })

  const loadCategories = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAdminCategories()
      setCategories(data ?? [])
    } catch (err) {
      setError(err.userMessage ?? 'Impossible de charger les catégories.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  // --- Actions Création / Renommage ---

  function openCreateMainModal() {
    setModal({
      open: true,
      mode: 'create_main',
      category: null,
      parentId: null,
      name: '',
      submitting: false,
      formError: null,
    })
  }

  function openCreateSubModal(parentCat) {
    setModal({
      open: true,
      mode: 'create_sub',
      category: null,
      parentId: parentCat.id,
      name: '',
      submitting: false,
      formError: null,
    })
  }

  function openRenameModal(cat) {
    setModal({
      open: true,
      mode: 'rename',
      category: cat,
      parentId: cat.parent_id ?? null,
      name: cat.name,
      submitting: false,
      formError: null,
    })
  }

  function closeModal() {
    setModal((prev) => ({ ...prev, open: false, submitting: false, formError: null }))
  }

  async function handleModalSubmit(e) {
    e.preventDefault()
    const trimmed = modal.name.trim()
    if (!trimmed) {
      setModal((prev) => ({ ...prev, formError: 'Le nom de la catégorie est obligatoire.' }))
      return
    }

    setModal((prev) => ({ ...prev, submitting: true, formError: null }))
    setError(null)
    setSuccessNotice(null)

    try {
      if (modal.mode === 'create_main') {
        await createAdminCategory({ name: trimmed, parent_id: null })
        setSuccessNotice(`Catégorie principale « ${trimmed} » créée avec succès.`)
      } else if (modal.mode === 'create_sub') {
        await createAdminCategory({ name: trimmed, parent_id: modal.parentId })
        setSuccessNotice(`Sous-catégorie « ${trimmed} » ajoutée avec succès.`)
      } else if (modal.mode === 'rename' && modal.category) {
        await updateAdminCategory(modal.category.id, { name: trimmed })
        setSuccessNotice(`Catégorie « ${trimmed} » renommée avec succès.`)
      }
      closeModal()
      await loadCategories()
    } catch (err) {
      const apiMessage = err.response?.data?.message ?? err.userMessage ?? 'Une erreur est survenue.'
      setModal((prev) => ({ ...prev, formError: apiMessage, submitting: false }))
    }
  }

  // --- Actions Réordonnancement ---

  async function handleMoveMain(index, direction) {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= categories.length) return

    const newCategories = [...categories]
    const temp = newCategories[index]
    newCategories[index] = newCategories[targetIndex]
    newCategories[targetIndex] = temp

    const items = newCategories.map((cat, idx) => ({
      id: cat.id,
      position: idx + 1,
      parent_id: null,
    }))

    setCategories(newCategories)
    setError(null)

    try {
      await reorderAdminCategories(items)
      setSuccessNotice('Ordre des catégories mis à jour.')
    } catch (err) {
      setError(err.userMessage ?? 'Impossible de mettre à jour l’ordre des catégories.')
      await loadCategories()
    }
  }

  async function handleMoveSub(parentCat, subIndex, direction) {
    const children = parentCat.children ?? []
    const targetIndex = direction === 'up' ? subIndex - 1 : subIndex + 1
    if (targetIndex < 0 || targetIndex >= children.length) return

    const newChildren = [...children]
    const temp = newChildren[subIndex]
    newChildren[subIndex] = newChildren[targetIndex]
    newChildren[targetIndex] = temp

    const updatedCategories = categories.map((cat) => {
      if (cat.id === parentCat.id) {
        return { ...cat, children: newChildren }
      }
      return cat
    })

    const items = newChildren.map((child, idx) => ({
      id: child.id,
      position: idx + 1,
      parent_id: parentCat.id,
    }))

    setCategories(updatedCategories)
    setError(null)

    try {
      await reorderAdminCategories(items)
      setSuccessNotice('Ordre des sous-catégories mis à jour.')
    } catch (err) {
      setError(err.userMessage ?? 'Impossible de mettre à jour l’ordre des sous-catégories.')
      await loadCategories()
    }
  }

  // --- Actions Suppression ---

  function openDeleteModal(cat) {
    setDeleteModal({
      open: true,
      category: cat,
      deleting: false,
      error: null,
    })
  }

  function closeDeleteModal() {
    setDeleteModal({
      open: false,
      category: null,
      deleting: false,
      error: null,
    })
  }

  async function handleConfirmDelete() {
    if (!deleteModal.category || deleteModal.deleting) return

    setDeleteModal((prev) => ({ ...prev, deleting: true, error: null }))
    setError(null)
    setSuccessNotice(null)

    try {
      const res = await deleteAdminCategory(deleteModal.category.id)
      setSuccessNotice(res.message ?? `La catégorie « ${deleteModal.category.name} » a été supprimée.`)
      closeDeleteModal()
      await loadCategories()
    } catch (err) {
      const apiMessage = err.response?.data?.message ?? err.userMessage ?? 'Suppression impossible.'
      setDeleteModal((prev) => ({ ...prev, deleting: false, error: apiMessage }))
      // Affiche également dans la bannière globale d'erreur
      setError(apiMessage)
    }
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Gestion des catégories</h1>
          <p className="mt-0.5 text-sm text-muted">
            Organisez l'arborescence du catalogue : catégories principales et sous-catégories (SCRUM-32 / F06).
          </p>
        </div>
        <div>
          <button
            type="button"
            onClick={openCreateMainModal}
            className="btn btn-primary shadow-xs"
          >
            + Nouvelle catégorie
          </button>
        </div>
      </div>

      {/* Notifications globales */}
      {successNotice && (
        <div
          role="status"
          className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          <span>{successNotice}</span>
          <button
            type="button"
            className="text-emerald-700 hover:text-emerald-900"
            onClick={() => setSuccessNotice(null)}
          >
            ✕
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
        >
          <span className="font-medium">{error}</span>
          <button
            type="button"
            className="text-rose-700 hover:text-rose-900"
            onClick={() => setError(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* État de chargement */}
      {loading ? (
        <div className="card text-center py-12 text-muted">
          <p>Chargement des catégories...</p>
        </div>
      ) : categories.length === 0 ? (
        <div className="card text-center py-12 text-muted">
          <p>Aucune catégorie configurée pour le moment.</p>
          <button
            type="button"
            onClick={openCreateMainModal}
            className="btn btn-secondary mt-4"
          >
            Créer la première catégorie
          </button>
        </div>
      ) : (
        /* Vue Arborescente */
        <div className="space-y-4">
          {categories.map((parentCat, parentIdx) => {
            const children = parentCat.children ?? []
            const isFirst = parentIdx === 0
            const isLast = parentIdx === categories.length - 1

            return (
              <div
                key={parentCat.id}
                className="card overflow-hidden border border-line bg-surface p-0 transition-all hover:border-slate-300"
              >
                {/* Ligne Catégorie Principale */}
                <div className="flex flex-col gap-3 border-b border-line bg-page/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    {/* Boutons réordonner catégorie principale */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={isFirst}
                        onClick={() => handleMoveMain(parentIdx, 'up')}
                        className="rounded p-1 text-muted hover:bg-slate-200 hover:text-ink disabled:opacity-30"
                        title="Monter"
                        aria-label={`Monter ${parentCat.name}`}
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        disabled={isLast}
                        onClick={() => handleMoveMain(parentIdx, 'down')}
                        className="rounded p-1 text-muted hover:bg-slate-200 hover:text-ink disabled:opacity-30"
                        title="Descendre"
                        aria-label={`Descendre ${parentCat.name}`}
                      >
                        ▼
                      </button>
                    </div>

                    <div>
                      <span className="text-xs font-mono font-semibold text-muted mr-2">
                        #{parentCat.position}
                      </span>
                      <span className="text-base font-bold text-ink">
                        {parentCat.name}
                      </span>
                    </div>

                    {/* Badges d'utilisation */}
                    <div className="flex items-center gap-1.5 ml-2">
                      <span
                        className="inline-flex items-center rounded-md bg-info-soft px-2 py-0.5 text-xs font-medium text-info"
                        title="Produits rattachés à cette catégorie ou ses sous-catégories"
                      >
                        {parentCat.products_count ?? 0} produit{(parentCat.products_count ?? 0) > 1 ? 's' : ''}
                      </span>
                      <span
                        className="inline-flex items-center rounded-md bg-page px-2 py-0.5 text-xs text-muted"
                        title="Demandes rattachées"
                      >
                        {parentCat.tenders_count ?? 0} demande{(parentCat.tenders_count ?? 0) > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Actions catégorie principale */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openCreateSubModal(parentCat)}
                      className="btn btn-secondary text-xs"
                    >
                      + Sous-catégorie
                    </button>
                    <button
                      type="button"
                      onClick={() => openRenameModal(parentCat)}
                      className="btn btn-ghost text-xs"
                    >
                      Renommer
                    </button>
                    <button
                      type="button"
                      onClick={() => openDeleteModal(parentCat)}
                      className="btn text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>

                {/* Liste des sous-catégories indentées */}
                <div className="p-4">
                  {children.length === 0 ? (
                    <p className="py-2 text-xs text-muted italic">
                      Aucune sous-catégorie. Cliquez sur « + Sous-catégorie » pour en ajouter une.
                    </p>
                  ) : (
                    <ul className="divide-y divide-line/60">
                      {children.map((childCat, childIdx) => {
                        const isSubFirst = childIdx === 0
                        const isSubLast = childIdx === children.length - 1

                        return (
                          <li
                            key={childCat.id}
                            className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between pl-6"
                          >
                            <div className="flex items-center gap-3">
                              {/* Flèche d'indentation */}
                              <span className="text-muted/60 font-mono text-sm">└─</span>

                              {/* Boutons réordonner sous-catégorie */}
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={isSubFirst}
                                  onClick={() => handleMoveSub(parentCat, childIdx, 'up')}
                                  className="rounded p-1 text-xs text-muted hover:bg-slate-200 hover:text-ink disabled:opacity-30"
                                  title="Monter"
                                  aria-label={`Monter ${childCat.name}`}
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  disabled={isSubLast}
                                  onClick={() => handleMoveSub(parentCat, childIdx, 'down')}
                                  className="rounded p-1 text-xs text-muted hover:bg-slate-200 hover:text-ink disabled:opacity-30"
                                  title="Descendre"
                                  aria-label={`Descendre ${childCat.name}`}
                                >
                                  ▼
                                </button>
                              </div>

                              <span className="text-xs font-mono text-muted">
                                #{childCat.position}
                              </span>
                              <span className="text-sm font-medium text-ink">
                                {childCat.name}
                              </span>

                              {/* Badges sous-catégorie */}
                              <div className="flex items-center gap-1.5 ml-2">
                                <span className="inline-flex items-center rounded-md bg-info-soft/70 px-2 py-0.5 text-[11px] font-medium text-info">
                                  {childCat.products_count ?? 0} prod.
                                </span>
                                <span className="inline-flex items-center rounded-md bg-page px-2 py-0.5 text-[11px] text-muted">
                                  {childCat.tenders_count ?? 0} dem.
                                </span>
                              </div>
                            </div>

                            {/* Actions sous-catégorie */}
                            <div className="flex items-center gap-2 self-end sm:self-auto">
                              <button
                                type="button"
                                onClick={() => openRenameModal(childCat)}
                                className="btn btn-ghost text-xs py-1"
                              >
                                Renommer
                              </button>
                              <button
                                type="button"
                                onClick={() => openDeleteModal(childCat)}
                                className="btn text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 py-1"
                              >
                                Supprimer
                              </button>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modale Création / Renommage */}
      {modal.open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="category-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl">
            <h2 id="category-modal-title" className="text-lg font-bold text-ink">
              {modal.mode === 'create_main' && 'Créer une catégorie principale'}
              {modal.mode === 'create_sub' && 'Ajouter une sous-catégorie'}
              {modal.mode === 'rename' && 'Renommer la catégorie'}
            </h2>

            <form onSubmit={handleModalSubmit} className="mt-4 space-y-4">
              <div>
                <label htmlFor="category-name" className="block text-sm font-medium text-ink">
                  Nom de la catégorie <span className="text-danger">*</span>
                </label>
                <input
                  id="category-name"
                  type="text"
                  required
                  value={modal.name}
                  onChange={(e) => setModal((prev) => ({ ...prev, name: e.target.value, formError: null }))}
                  placeholder="Ex : Équipements de protection, Machines-outils..."
                  className="input mt-1.5"
                  autoFocus
                />
                {modal.formError && (
                  <p role="alert" className="mt-1.5 text-xs text-danger font-medium">
                    {modal.formError}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={modal.submitting}
                  className="btn btn-secondary"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={modal.submitting || !modal.name.trim()}
                  className="btn btn-primary"
                >
                  {modal.submitting ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale Confirmation de Suppression avec message explicite */}
      {deleteModal.open && deleteModal.category && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl">
            <h2 id="delete-modal-title" className="text-lg font-bold text-ink">
              Supprimer « {deleteModal.category.name} » ?
            </h2>

            <p className="mt-2 text-sm text-muted">
              Cette action est irréversible. La suppression sera automatiquement bloquée si la catégorie
              (ou l'une de ses sous-catégories) est utilisée par des produits ou des demandes.
            </p>

            {deleteModal.error && (
              <div
                role="alert"
                className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"
              >
                <p className="font-semibold">Suppression impossible :</p>
                <p className="mt-0.5">{deleteModal.error}</p>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleteModal.deleting}
                className="btn btn-secondary"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteModal.deleting}
                className="btn bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {deleteModal.deleting ? 'Suppression...' : 'Confirmer la suppression'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
