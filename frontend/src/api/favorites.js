import { http } from './http'

/**
 * Fournisseurs favoris du porteur de projet connecté (SCRUM-39).
 * Liste : [{ id, company_name, logo_url, region, rating_avg, reviews_count, categories: [nom], favorited_at }]
 */
export async function fetchFavoriteSuppliers() {
  const { data } = await http.get('/favorites/suppliers')
  return data
}

/** Idempotent. Renvoie { message, is_favorite: true }. */
export async function addFavoriteSupplier(supplierId) {
  const { data } = await http.post(`/favorites/suppliers/${supplierId}`)
  return data
}

/** Idempotent. Renvoie { message, is_favorite: false }. */
export async function removeFavoriteSupplier(supplierId) {
  const { data } = await http.delete(`/favorites/suppliers/${supplierId}`)
  return data
}
