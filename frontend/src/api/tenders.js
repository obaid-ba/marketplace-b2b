import { http } from './http'

/**
 * Demandes du porteur de projet (F11 / SCRUM-41, SCRUM-43, SCRUM-49).
 */

/** Catégories et régions proposées dans le formulaire de publication. */
export async function fetchTenderReferences() {
  const [regions, categories] = await Promise.all([
    http.get('/reference/regions'),
    http.get('/reference/categories'),
  ])

  return { regions: regions.data, categories: categories.data }
}

export async function fetchBuyerTenders(params = {}) {
  const { data } = await http.get('/buyer/tenders', { params })
  return data
}

export async function fetchBuyerTender(id) {
  const { data } = await http.get(`/buyer/tenders/${id}`)
  return data
}

/**
 * Publie une demande. Les pièces jointes passent par multipart/form-data.
 * @param {{ title: string, description: string, category_id: number, region_id?: number|null, budget?: number|null, desired_deadline?: string|null }} payload
 * @param {File[]} attachments
 */
export async function createTender(payload, attachments = []) {
  const form = new FormData()

  Object.entries(payload).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') form.append(key, value)
  })

  attachments.forEach((file) => form.append('attachments[]', file))

  const { data } = await http.post('/buyer/tenders', form)
  return data
}

export async function cancelTender(id) {
  const { data } = await http.post(`/buyer/tenders/${id}/cancel`)
  return data
}

export async function inviteSupplier(tenderId, supplierId) {
  const { data } = await http.post(`/buyer/tenders/${tenderId}/invite`, { supplier_id: supplierId })
  return data
}

export async function fetchFavoriteSuppliers(tenderId) {
  const { data } = await http.get('/buyer/favorites', {
    params: tenderId ? { tender_id: tenderId } : {},
  })
  return data
}

export async function addFavoriteSupplier(supplierId) {
  const { data } = await http.post('/buyer/favorites', { supplier_id: supplierId })
  return data
}

export async function removeFavoriteSupplier(supplierId) {
  const { data } = await http.delete(`/buyer/favorites/${supplierId}`)
  return data
}
