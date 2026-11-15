import { http } from './http'

/**
 * File des demandes fournisseurs (SCRUM-31) :
 * Récupère les fournisseurs selon le statut ('en attente', 'validé', 'refusé', 'all').
 */
export async function fetchAdminSuppliers(status = 'en attente', page = 1) {
  const { data } = await http.get('/admin/suppliers', {
    params: { status, page },
  })
  return data
}

/**
 * Détail complet d'un fournisseur et de ses justificatifs.
 */
export async function fetchAdminSupplier(id) {
  const { data } = await http.get(`/admin/suppliers/${id}`)
  return data.supplier
}

/**
 * Consultation / téléchargement d'un document justificatif envoyé par un fournisseur.
 * Télécharge le fichier avec le jeton Bearer puis l'ouvre dans un nouvel onglet.
 */
export async function openAdminDocument(document) {
  const tab = window.open('', '_blank')
  try {
    const { data } = await http.get(`/admin/suppliers/documents/${document.id}/download`, {
      responseType: 'blob',
    })
    const url = URL.createObjectURL(data)
    if (tab) {
      tab.location.href = url
    } else {
      window.location.assign(url)
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (error) {
    tab?.close()
    throw error
  }
}

/**
 * Valider le dossier d'un fournisseur (SCRUM-31).
 */
export async function approveSupplier(id) {
  const { data } = await http.post(`/admin/suppliers/${id}/approve`)
  return data
}

/**
 * Refuser le dossier d'un fournisseur avec un motif obligatoire (SCRUM-31).
 */
export async function rejectSupplier(id, reason) {
  const { data } = await http.post(`/admin/suppliers/${id}/reject`, { reason })
  return data
}
