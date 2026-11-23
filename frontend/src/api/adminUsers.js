import { http } from './http'

/** Gestion des utilisateurs (SCRUM-118 / F24). */

export async function fetchAdminUsers(params = {}) {
  const { data } = await http.get('/admin/users', { params })
  return data
}

/** @returns {Promise<{ user: object, activity: object, history: object[] }>} */
export async function fetchAdminUser(id) {
  const { data } = await http.get(`/admin/users/${id}`)
  return data
}

export async function suspendUser(id, reason) {
  const { data } = await http.post(`/admin/users/${id}/suspend`, { reason })
  return data
}

export async function reactivateUser(id, reason) {
  const { data } = await http.post(`/admin/users/${id}/reactivate`, { reason })
  return data
}
