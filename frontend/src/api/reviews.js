import { http } from './http'

/**
 * Dépose un avis sur une commande clôturée côté acheteur (SCRUM-64 / F20).
 * payload: { rating: number, comment?: string }
 */
export async function submitBuyerReview(orderId, payload) {
  const { data } = await http.post(`/buyer/orders/${orderId}/review`, payload)
  return data
}

/**
 * Récupère les avis reçus par le fournisseur connecté et les statistiques (SCRUM-65 / F20).
 */
export async function fetchSupplierReviews(page = 1) {
  const { data } = await http.get('/supplier/reviews', { params: { page } })
  return data
}

/**
 * Répond à un avis reçu côté fournisseur (SCRUM-65 / F20).
 */
export async function replyToSupplierReview(reviewId, reply) {
  const { data } = await http.post(`/supplier/reviews/${reviewId}/reply`, { reply })
  return data
}

/**
 * Récupère les avis publiés d'un fournisseur (consultation publique).
 */
export async function fetchPublicSupplierReviews(supplierId, page = 1) {
  const { data } = await http.get(`/suppliers/${supplierId}/reviews`, { params: { page } })
  return data
}
