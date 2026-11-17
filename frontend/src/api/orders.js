import { http } from './http'

/**
 * Commandes du porteur, créées par acceptation d'un devis (SCRUM-48).
 */

export async function fetchBuyerOrders(params = {}) {
  const { data } = await http.get('/buyer/orders', { params })
  return data
}

export async function fetchBuyerOrder(id) {
  const { data } = await http.get(`/buyer/orders/${id}`)
  return data
}
