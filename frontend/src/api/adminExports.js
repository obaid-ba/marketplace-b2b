import { http } from './http'

/**
 * Exports des statistiques d'administration (SCRUM-75 / F28).
 * Le fichier est produit par un job : l'API répond 202 puis la liste indique
 * quand l'export est prêt.
 */
export async function fetchExports(params = {}) {
  const { data } = await http.get('/admin/exports', { params })
  return data
}

export async function createExport({ from, to, format = 'csv', indicators } = {}) {
  const { data } = await http.post('/admin/exports', { from, to, format, indicators })
  return data
}

/** Télécharge le fichier et déclenche l'enregistrement dans le navigateur. */
export async function downloadExport(id, format = 'csv') {
  const response = await http.get(`/admin/exports/${id}/download`, { responseType: 'blob' })
  const url = URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = url
  link.download = `statistiques-${id}.${format}`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
