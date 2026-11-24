import { http } from './http'

/**
 * Modération du catalogue et des avis signalés (SCRUM-72, SCRUM-74 / F29).
 */
export async function fetchAdminProducts(params = {}) {
  const { data } = await http.get('/admin/products', { params })
  return data
}

export async function withdrawProduct(id, reason) {
  const { data } = await http.post(`/admin/products/${id}/withdraw`, { reason })
  return data
}

export async function fetchReportedReviews(params = {}) {
  const { data } = await http.get('/admin/reported-reviews', { params })
  return data
}

export async function keepReview(id) {
  const { data } = await http.post(`/admin/reported-reviews/${id}/keep`)
  return data
}

export async function hideReview(id, reason) {
  const { data } = await http.post(`/admin/reported-reviews/${id}/hide`, { reason })
  return data
}
