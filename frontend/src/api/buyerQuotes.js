import { http } from './http'

/**
 * Comparaison et acceptation des devis reçus (F14 / SCRUM-47, SCRUM-48).
 */

export async function fetchTenderQuotes(tenderId, { sort = 'amount', direction = 'asc' } = {}) {
  const { data } = await http.get(`/buyer/tenders/${tenderId}/quotes`, {
    params: { sort, direction },
  })
  return data
}

export async function acceptQuote(quoteId) {
  const { data } = await http.post(`/buyer/quotes/${quoteId}/accept`)
  return data
}
