import { http } from './http'
import { saveBlob } from '@/utils/saveBlob'

/** Litiges (SCRUM-117 / F23). */

/** @returns {Promise<{ dispute: object|null, can_open: boolean, reasons: string[] }>} */
export async function fetchOrderDispute(orderId) {
  const { data } = await http.get(`/orders/${orderId}/dispute`)
  return data
}

/** Litiges de l'acheteur ou du fournisseur connecté (SCRUM-67). */
export async function fetchMyDisputes(params = {}) {
  const { data } = await http.get('/disputes', { params })
  return data
}

export async function openDispute(orderId, { reason, description, files }) {
  const form = new FormData()
  form.append('reason', reason)
  form.append('description', description)
  files.forEach((file) => form.append('attachments[]', file))
  const { data } = await http.post(`/buyer/orders/${orderId}/dispute`, form, { timeout: 120000 })
  return data
}

export async function fetchDispute(id) {
  const { data } = await http.get(`/disputes/${id}`)
  return data
}

export async function downloadDisputeAttachment(disputeId, attachment) {
  const { data } = await http.get(`/disputes/${disputeId}/attachments/${attachment.id}`, { responseType: 'blob', timeout: 120000 })
  saveBlob(data, attachment.original_name)
}

// --- Administration ---

export async function fetchAdminDisputes(params = {}) {
  const { data } = await http.get('/admin/disputes', { params })
  return data
}

/** @returns {Promise<{ data: object, decisions: string[] }>} */
export async function fetchAdminDispute(id) {
  const { data } = await http.get(`/admin/disputes/${id}`)
  return data
}

export async function takeDispute(id) {
  const { data } = await http.post(`/admin/disputes/${id}/take`)
  return data
}

export async function decideDispute(id, payload) {
  const { data } = await http.post(`/admin/disputes/${id}/decide`, payload)
  return data
}
