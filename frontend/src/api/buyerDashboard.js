import { http } from './http'

/**
 * Tableau de bord porteur de projet (SCRUM-121 / F27).
 * `from` et `to` sont facultatifs : sans eux, l'API renvoie les 30 derniers jours.
 */
export async function fetchBuyerDashboard({ from, to } = {}) {
  const params = {}
  if (from) params.from = from
  if (to) params.to = to

  const { data } = await http.get('/buyer/dashboard', { params })
  return data
}
