import { http } from './http'

/**
 * Journal d'audit (SCRUM-76), lecture seule.
 * Réponse paginée : { data, meta, actions: [code], admins: [{ id, name }] }.
 */
export async function fetchAuditLogs(params = {}) {
  const { data } = await http.get('/admin/audit-logs', { params })
  return data
}
