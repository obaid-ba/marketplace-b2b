import { http } from './http'

/** Résumé automatique des devis (SCRUM-119 / F25). Réponse : { can_generate, summary | null } */

export async function fetchQuoteSummary(tenderId) {
  const { data } = await http.get(`/buyer/tenders/${tenderId}/quotes/summary`)
  return data
}

/** Sans force, l'API renvoie le résumé existant s'il est à jour. Une génération peut être longue. */
export async function generateQuoteSummary(tenderId, { force = false } = {}) {
  const { data } = await http.post(`/buyer/tenders/${tenderId}/quotes/summary`, { force }, { timeout: 60000 })
  return data
}

export async function updateQuoteSummary(tenderId, changes) {
  const { data } = await http.patch(`/buyer/tenders/${tenderId}/quotes/summary`, changes)
  return data
}
