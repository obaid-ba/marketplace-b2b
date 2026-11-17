import { useCallback, useEffect, useState } from 'react'
import {
  approveSupplier,
  fetchAdminDocumentBlob,
  fetchAdminSuppliers,
  rejectSupplier,
} from '@/api/adminSuppliers'
import StatusBadge from '@/components/StatusBadge'
import { selectUser, useAuthStore } from '@/stores/auth'
import { SUPPLIER_STATUS } from '@/utils/roles'
import { DOCUMENT_TYPES } from '@/utils/supplierDocuments'
import { formatRelativeDate } from '@/utils/relativeDate'

const TABS = [
  { id: SUPPLIER_STATUS.PENDING, label: 'En attente' },
  { id: SUPPLIER_STATUS.VALIDATED, label: 'Validés' },
  { id: SUPPLIER_STATUS.REJECTED, label: 'Refusés' },
  { id: 'all', label: 'Tous' },
]

export default function AdminDashboard() {
  const user = useAuthStore(selectUser)

  const [activeTab, setActiveTab] = useState(SUPPLIER_STATUS.PENDING)
  const [suppliers, setSuppliers] = useState([])
  const [pagination, setPagination] = useState({ current_page: 1, last_page: 1, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [successNotice, setSuccessNotice] = useState(null)

  // Actions d'approbation et de chargement
  const [actionLoadingId, setActionLoadingId] = useState(null)

  // Visionneuse de document intégrée
  const [viewerDoc, setViewerDoc] = useState(null)
  const [viewerBlobUrl, setViewerBlobUrl] = useState(null)
  const [viewerLoading, setViewerLoading] = useState(false)
  const [viewerError, setViewerError] = useState(null)

  // Modale de refus
  const [rejectModalSupplier, setRejectModalSupplier] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectError, setRejectError] = useState(null)
  const [rejectSubmitting, setRejectSubmitting] = useState(false)

  const loadSuppliers = useCallback(async (status, page = 1) => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAdminSuppliers(status, page)
      setSuppliers(data.data ?? [])
      setPagination({
        current_page: data.current_page ?? 1,
        last_page: data.last_page ?? 1,
        total: data.total ?? (data.data?.length ?? 0),
      })
    } catch (err) {
      setError(err.userMessage ?? 'Impossible de charger la liste des dossiers fournisseurs.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSuppliers(activeTab, 1)
  }, [activeTab, loadSuppliers])

  async function handleApprove(supplier) {
    if (actionLoadingId) return
    setActionLoadingId(supplier.id)
    setError(null)
    setSuccessNotice(null)
    try {
      await approveSupplier(supplier.id)
      setSuccessNotice(`Le dossier de l'entreprise « ${supplier.company_name} » a été validé avec succès.`)
      await loadSuppliers(activeTab, pagination.current_page)
    } catch (err) {
      setError(err.userMessage ?? 'Une erreur est survenue lors de la validation du dossier.')
    } finally {
      setActionLoadingId(null)
    }
  }

  function openRejectModal(supplier) {
    setRejectModalSupplier(supplier)
    setRejectReason('')
    setRejectError(null)
  }

  function closeRejectModal() {
    setRejectModalSupplier(null)
    setRejectReason('')
    setRejectError(null)
    setRejectSubmitting(false)
  }

  async function handleConfirmReject(e) {
    e.preventDefault()
    if (!rejectModalSupplier || rejectSubmitting) return

    const trimmed = rejectReason.trim()
    if (trimmed.length < 5) {
      setRejectError('Le motif du refus est obligatoire et doit contenir au moins 5 caractères.')
      return
    }

    setRejectSubmitting(true)
    setRejectError(null)
    try {
      await rejectSupplier(rejectModalSupplier.id, trimmed)
      setSuccessNotice(`Le dossier de l'entreprise « ${rejectModalSupplier.company_name} » a été refusé.`)
      closeRejectModal()
      await loadSuppliers(activeTab, pagination.current_page)
    } catch (err) {
      setRejectError(err.userMessage ?? 'Une erreur est survenue lors du refus du dossier.')
    } finally {
      setRejectSubmitting(false)
    }
  }

  async function handleOpenViewer(doc) {
    setViewerDoc(doc)
    setViewerLoading(true)
    setViewerError(null)
    if (viewerBlobUrl) {
      URL.revokeObjectURL(viewerBlobUrl)
      setViewerBlobUrl(null)
    }

    try {
      const blob = await fetchAdminDocumentBlob(doc)
      const url = URL.createObjectURL(blob)
      setViewerBlobUrl(url)
    } catch (err) {
      setViewerError(err.userMessage ?? 'Impossible de charger le document pour la prévisualisation.')
    } finally {
      setViewerLoading(false)
    }
  }

  function closeViewer() {
    if (viewerBlobUrl) {
      URL.revokeObjectURL(viewerBlobUrl)
      setViewerBlobUrl(null)
    }
    setViewerDoc(null)
    setViewerError(null)
    setViewerLoading(false)
  }

  function documentLabel(type) {
    const found = DOCUMENT_TYPES.find((d) => d.value === type)
    return found ? found.label : type
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Validation des fournisseurs</h1>
          <p className="mt-0.5 text-sm text-muted">
            Examinez les dossiers d'inscription des nouveaux fournisseurs (SCRUM-31 / F05).
          </p>
        </div>
        {user && (
          <div className="text-xs text-muted sm:text-right">
            Connecté en tant que <span className="font-semibold text-ink">{user.name}</span>
          </div>
        )}
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
          <span>{error}</span>
          <button
            type="button"
            className="text-rose-700 hover:text-rose-900"
            onClick={() => setError(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Onglets de filtrage */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line pb-3">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'bg-surface text-muted hover:bg-page hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
        <div className="ml-auto text-xs text-muted">
          {pagination.total} dossier{pagination.total > 1 ? 's' : ''} au total
        </div>
      </div>

      {/* État de chargement */}
      {loading ? (
        <div className="card text-center py-12 text-muted">
          <p>Chargement des dossiers fournisseurs...</p>
        </div>
      ) : suppliers.length === 0 ? (
        <div className="card text-center py-12 text-muted">
          <p>Aucun dossier fournisseur dans cette file.</p>
        </div>
      ) : (
        /* File des demandes triée de la plus ancienne à la plus récente */
        <div className="space-y-4">
          {suppliers.map((supplier) => {
            const isApproved = supplier.validation_status === SUPPLIER_STATUS.VALIDATED
            const isRejected = supplier.validation_status === SUPPLIER_STATUS.REJECTED
            const isActionLoading = actionLoadingId === supplier.id

            return (
              <div
                key={supplier.id}
                className="card flex flex-col justify-between gap-6 transition-all hover:border-slate-300 md:flex-row md:items-start"
              >
                {/* Colonne gauche : infos complètes entreprise et contact */}
                <div className="space-y-4 md:max-w-2xl">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-lg font-bold text-ink">{supplier.company_name}</h2>
                    <StatusBadge status={supplier.validation_status} />
                    <span className="text-xs text-muted">
                      Soumis {formatRelativeDate(supplier.created_at) ?? 'récemment'}
                    </span>
                  </div>

                  {/* Grille détaillée des informations */}
                  <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                    {supplier.user && (
                      <div>
                        <span className="text-muted">Gérant / Contact :</span>{' '}
                        <span className="font-medium text-ink">{supplier.user.name}</span>
                      </div>
                    )}
                    {supplier.user?.email && (
                      <div>
                        <span className="text-muted">E-mail :</span>{' '}
                        <span className="font-medium text-ink">{supplier.user.email}</span>
                      </div>
                    )}
                    {supplier.user?.phone && (
                      <div>
                        <span className="text-muted">Téléphone :</span>{' '}
                        <span className="font-medium text-ink">{supplier.user.phone}</span>
                      </div>
                    )}
                    {supplier.region?.name && (
                      <div>
                        <span className="text-muted">Région :</span>{' '}
                        <span className="font-medium text-ink">{supplier.region.name}</span>
                      </div>
                    )}
                    {supplier.city && (
                      <div>
                        <span className="text-muted">Ville :</span>{' '}
                        <span className="font-medium text-ink">{supplier.city}</span>
                      </div>
                    )}
                    {supplier.address && (
                      <div>
                        <span className="text-muted">Adresse :</span>{' '}
                        <span className="font-medium text-ink">{supplier.address}</span>
                      </div>
                    )}
                    {supplier.legal_form && (
                      <div>
                        <span className="text-muted">Forme juridique :</span>{' '}
                        <span className="font-medium text-ink">{supplier.legal_form}</span>
                      </div>
                    )}
                    {supplier.tax_id && (
                      <div>
                        <span className="text-muted">Matricule fiscal :</span>{' '}
                        <span className="font-medium text-ink">{supplier.tax_id}</span>
                      </div>
                    )}
                    {supplier.rne_number && (
                      <div>
                        <span className="text-muted">N° RNE :</span>{' '}
                        <span className="font-medium text-ink">{supplier.rne_number}</span>
                      </div>
                    )}
                    {supplier.sector && (
                      <div>
                        <span className="text-muted">Secteur :</span>{' '}
                        <span className="font-medium text-ink">{supplier.sector}</span>
                      </div>
                    )}
                    {supplier.website && (
                      <div>
                        <span className="text-muted">Site web :</span>{' '}
                        <a
                          href={supplier.website.startsWith('http') ? supplier.website : `https://${supplier.website}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-brand-600 hover:underline"
                        >
                          {supplier.website}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Catégories de produits/services */}
                  {supplier.categories && supplier.categories.length > 0 && (
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                        Catégories :
                      </span>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {supplier.categories.map((cat) => (
                          <span
                            key={cat.id}
                            className="inline-flex items-center rounded-md bg-info-soft px-2 py-0.5 text-xs font-medium text-info"
                          >
                            {cat.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Zones de couverture */}
                  {supplier.coverageRegions && supplier.coverageRegions.length > 0 && (
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                        Zones de couverture :
                      </span>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {supplier.coverageRegions.map((reg) => (
                          <span
                            key={reg.id}
                            className="inline-flex items-center rounded-md border border-line bg-page px-2 py-0.5 text-xs text-muted"
                          >
                            {reg.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Motif de refus si statut refusé */}
                  {isRejected && supplier.rejection_reason && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-3 text-sm text-rose-800">
                      <p className="font-medium">Motif du refus :</p>
                      <p className="mt-0.5 text-rose-700">{supplier.rejection_reason}</p>
                    </div>
                  )}

                  {/* Détail validation si validé */}
                  {isApproved && supplier.validated_at && (
                    <div className="text-xs text-muted">
                      Dossier validé {formatRelativeDate(supplier.validated_at)}
                      {supplier.validator?.name && ` par ${supplier.validator.name}`}
                    </div>
                  )}

                  {/* Documents justificatifs envoyés */}
                  <div className="pt-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                      Documents justificatifs ({supplier.documents?.length ?? 0})
                    </h3>
                    {supplier.documents && supplier.documents.length > 0 ? (
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {supplier.documents.map((doc) => (
                          <li
                            key={doc.id}
                            className="inline-flex items-center gap-2 rounded-lg border border-line bg-page px-3 py-1.5 text-xs text-ink"
                          >
                            <span className="font-medium">{documentLabel(doc.type)}</span>
                            <StatusBadge status={doc.status} />
                            <button
                              type="button"
                              onClick={() => handleOpenViewer(doc)}
                              className="font-semibold text-brand-600 hover:text-brand-700 hover:underline"
                            >
                              Consulter / Prévisualiser
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-xs text-muted">Aucun justificatif joint.</p>
                    )}
                  </div>
                </div>

                {/* Colonne droite : Actions admin */}
                <div className="flex shrink-0 items-center gap-2 md:flex-col md:items-end">
                  {/* Bouton Accepter en un clic */}
                  <button
                    type="button"
                    disabled={isActionLoading || isApproved}
                    onClick={() => handleApprove(supplier)}
                    className={`btn text-sm font-medium ${
                      isApproved
                        ? 'cursor-not-allowed bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    {isActionLoading ? 'Validation...' : isApproved ? '✓ Validé' : 'Accepter le dossier'}
                  </button>

                  {/* Bouton Refuser ouvrant la modale */}
                  <button
                    type="button"
                    disabled={isActionLoading}
                    onClick={() => openRejectModal(supplier)}
                    className="btn border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-sm font-medium"
                  >
                    {isRejected ? 'Modifier le refus' : 'Refuser le dossier'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Visionneuse de document intégrée (Modale avec iframe ou img) */}
      {viewerDoc && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="viewer-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
        >
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-line bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h2 id="viewer-title" className="text-lg font-bold text-ink">
                  {documentLabel(viewerDoc.type)}
                </h2>
                <p className="text-xs text-muted">
                  Justificatif fourni par le fournisseur
                </p>
              </div>
              <div className="flex items-center gap-2">
                {viewerBlobUrl && (
                  <a
                    href={viewerBlobUrl}
                    download={viewerDoc.file_name ?? `${viewerDoc.type}.pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary text-xs"
                  >
                    Télécharger
                  </a>
                )}
                <button
                  type="button"
                  onClick={closeViewer}
                  className="rounded-lg p-1.5 text-muted hover:bg-page hover:text-ink"
                  aria-label="Fermer la prévisualisation"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto py-4">
              {viewerLoading ? (
                <div className="py-20 text-center text-sm text-muted">
                  Chargement sécurisé du document...
                </div>
              ) : viewerError ? (
                <div className="rounded-lg bg-rose-50 p-4 text-center text-sm text-rose-700">
                  {viewerError}
                </div>
              ) : viewerBlobUrl ? (
                viewerDoc.file_path?.match(/\.(jpg|jpeg|png|webp)$/i) ? (
                  <img
                    src={viewerBlobUrl}
                    alt={documentLabel(viewerDoc.type)}
                    className="max-h-[600px] w-auto mx-auto rounded-lg object-contain shadow-xs"
                  />
                ) : (
                  <iframe
                    src={viewerBlobUrl}
                    title={documentLabel(viewerDoc.type)}
                    className="h-[600px] w-full rounded-lg border border-line"
                  />
                )
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Modale de refus avec motif obligatoire */}
      {rejectModalSupplier && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reject-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
        >
          <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-xl">
            <h2 id="reject-modal-title" className="text-lg font-bold text-ink">
              Refuser le dossier de « {rejectModalSupplier.company_name} »
            </h2>
            <p className="mt-1 text-sm text-muted">
              Le motif du refus est obligatoire et sera communiqué au fournisseur par e-mail et notification.
            </p>

            <form onSubmit={handleConfirmReject} className="mt-4 space-y-4">
              <div>
                <label htmlFor="rejection-reason" className="block text-sm font-medium text-ink">
                  Motif du refus <span className="text-danger">*</span>
                </label>
                <textarea
                  id="rejection-reason"
                  name="reason"
                  rows={4}
                  value={rejectReason}
                  onChange={(e) => {
                    setRejectReason(e.target.value)
                    if (rejectError) setRejectError(null)
                  }}
                  placeholder="Ex : Le registre de commerce fourni est expiré. Merci de téléverser un extrait RNE de moins de 3 mois."
                  className="input mt-1.5 resize-none"
                  autoFocus
                />
                <div className="mt-1 flex items-center justify-between text-xs text-muted">
                  <span>Minimum 5 caractères requis.</span>
                  <span>{rejectReason.trim().length} car.</span>
                </div>
                {rejectError && (
                  <p role="alert" className="mt-1 text-xs text-danger">
                    {rejectError}
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeRejectModal}
                  disabled={rejectSubmitting}
                  className="btn btn-secondary"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={rejectSubmitting || rejectReason.trim().length < 5}
                  className="btn bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {rejectSubmitting ? 'Envoi...' : 'Confirmer le refus'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
