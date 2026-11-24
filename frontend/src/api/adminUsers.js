import { http } from './http'

/**
 * Gestion des comptes utilisateurs (SCRUM-71).
 */
export async function fetchAdminUsers(params = {}) {
  const { data } = await http.get('/admin/users', { params })
  return data
}

export async function suspendUser(id, reason) {
  const { data } = await http.post(`/admin/users/${id}/suspend`, { reason })
  return data
}

export async function reactivateUser(id) {
  const { data } = await http.post(`/admin/users/${id}/reactivate`)
  return data
}

export async function deleteUser(id, reason) {
  const { data } = await http.delete(`/admin/users/${id}`, { data: { reason } })
  return data
}
