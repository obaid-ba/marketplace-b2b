import { http } from './http'

/**
 * Tableau de bord fournisseur (SCRUM-120 / F26).
 * `from` et `to` sont facultatifs : sans eux, l'API renvoie les 30 derniers jours.
 */
export async function fetchSupplierDashboard({ from, to } = {}) {
  const params = {}
  if (from) params.from = from
  if (to) params.to = to

  const { data } = await http.get('/supplier/dashboard', { params })
  return data
}
