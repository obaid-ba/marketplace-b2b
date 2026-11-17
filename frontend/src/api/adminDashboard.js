import { http } from './http'

/**
 * Tableau de bord administrateur (SCRUM-122 / F28, story SCRUM-70).
 * `from` et `to` sont facultatifs : sans eux, l'API renvoie les 30 derniers jours.
 */
export async function fetchAdminDashboard({ from, to } = {}) {
  const params = {}
  if (from) params.from = from
  if (to) params.to = to

  const { data } = await http.get('/admin/dashboard', { params })
  return data
}
