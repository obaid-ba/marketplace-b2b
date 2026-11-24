import { http } from './http'

/**
 * Litiges (SCRUM-67, SCRUM-73 / F21).
 */
export async function fetchAdminDisputes(params = {}) {
  const { data } = await http.get('/admin/disputes', { params })
  return data
}

export async function assignDispute(id) {
  const { data } = await http.post(`/admin/disputes/${id}/assign`)
  return data
}

export async function decideDispute(id, { decision, note }) {
  const { data } = await http.post(`/admin/disputes/${id}/decide`, { decision, note })
  return data
}

export async function fetchBuyerDisputes(params = {}) {
  const { data } = await http.get('/buyer/disputes', { params })
  return data
}

export async function createBuyerDispute(orderId, { reason, description, attachments = [] }) {
  const form = new FormData()
  form.append('reason', reason)
  form.append('description', description)
  attachments.forEach((file) => form.append('attachments[]', file))

  const { data } = await http.post(`/buyer/orders/${orderId}/disputes`, form)
  return data
}

export async function fetchSupplierDisputes(params = {}) {
  const { data } = await http.get('/supplier/disputes', { params })
  return data
}
