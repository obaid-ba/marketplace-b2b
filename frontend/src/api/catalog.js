import { http } from './http'

/**
 * Catalogue public (SCRUM-35) : accessible sans connexion.
 * params : { q, category, type, region, price_min, price_max, delay, rating, sort, page, per_page, supplier_id, exclude }
 * Réponse : { data: [ProductCard], meta: { current_page, last_page, total, from, to } }
 */
export async function searchProducts(params = {}, { signal } = {}) {
  const { data } = await http.get('/products', { params, signal })
  return data
}

/** Gouvernorats (filtre Région). */
export async function fetchRegions() {
  const { data } = await http.get('/reference/regions')
  return data
}
