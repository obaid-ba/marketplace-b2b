import { http } from './http'

/**
 * Produits du fournisseur connecté (SCRUM-33 ajouter / modifier, SCRUM-34 Mes produits).
 * Réservé à un fournisseur validé par l'administrateur.
 * Produit : { id, type: 'product'|'service', title, description, price, unit, stock, availability_days,
 *             status: 'draft'|'published'|'withdrawn', withdrawal_reason, category_id, images: [{ id, url, position }] }
 */

export async function fetchSupplierProduct(id) {
  const { data } = await http.get(`/supplier/products/${id}`)
  return data
}

/** Renvoie { message, product }. */
export async function createSupplierProduct(payload) {
  const { data } = await http.post('/supplier/products', payload)
  return data
}

/** Renvoie { message, product }. */
export async function updateSupplierProduct(id, payload) {
  const { data } = await http.put(`/supplier/products/${id}`, payload)
  return data
}

/** Ajoute des photos (à la fin). Renvoie { message, product }. */
export async function uploadProductImages(id, files) {
  const body = new FormData()
  files.forEach((file) => body.append('images[]', file))
  const { data } = await http.post(`/supplier/products/${id}/images`, body)
  return data
}

/** imageIds : toutes les photos, dans le nouvel ordre (la première = principale). */
export async function reorderProductImages(id, imageIds) {
  const { data } = await http.put(`/supplier/products/${id}/images/order`, { image_ids: imageIds })
  return data
}

export async function deleteProductImage(id, imageId) {
  const { data } = await http.delete(`/supplier/products/${id}/images/${imageId}`)
  return data
}

/**
 * Mes produits (SCRUM-34) : params { status, category_id, page }.
 * Réponse : { data: [produit + views_count + main_image_url], meta, counts: { all, draft, published, withdrawn } }
 */
export async function fetchSupplierProducts(params = {}) {
  const { data } = await http.get('/supplier/products', { params })
  return data
}

/** Dépublier : le produit repasse en brouillon. */
export async function unpublishSupplierProduct(id) {
  const { data } = await http.patch(`/supplier/products/${id}/unpublish`)
  return data
}

/** Durées proposées pour une mise en avant, en jours (SCRUM-40, ProductService::FEATURE_DURATIONS). */
export const FEATURE_DURATIONS = [7, 14, 30]

/** Mettre en avant un produit publié (SCRUM-40). Renvoie { message, product }. */
export async function featureSupplierProduct(id, days) {
  const { data } = await http.post(`/supplier/products/${id}/feature`, { days })
  return data
}

/** Arrêter la mise en avant (SCRUM-40). Renvoie { message, product }. */
export async function unfeatureSupplierProduct(id) {
  const { data } = await http.delete(`/supplier/products/${id}/feature`)
  return data
}

/** Supprimer : définitif, ou retiré seulement s'il a déjà été commandé. Renvoie { message, permanent }. */
export async function deleteSupplierProduct(id) {
  const { data } = await http.delete(`/supplier/products/${id}`)
  return data
}
