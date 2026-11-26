import { http } from './http'

/**
 * Fiche publique d'un fournisseur (SCRUM-37) : accessible sans connexion, 404 si non visible.
 * { id, company_name, logo_url, description, sector, region, categories: [{ id, name }], coverage_regions: [nom],
 *   rating_avg, reviews_count, products_count, is_favorite, ai_summary }
 */
export async function fetchSupplier(id) {
  const { data } = await http.get(`/suppliers/${id}`, { skipAuthRedirect: true })
  return data
}

/**
 * Annuaire public : params { q, region_id, category_id, sort: 'rating' | 'name' | 'products', page }.
 * Réponse : { data: [{ id, company_name, logo_url, sector, description, region, categories, rating_avg, reviews_count, products_count }], meta }.
 */
export async function searchSuppliers(params = {}) {
  const { data } = await http.get('/suppliers', { params, skipAuthRedirect: true })
  return data
}

/** Avis publiés : { data: [{ id, author, rating, comment, supplier_reply, created_at }], meta }. */
export async function fetchSupplierReviews(id, page = 1) {
  const { data } = await http.get(`/suppliers/${id}/reviews`, { params: page > 1 ? { page } : {} })
  return data
}
