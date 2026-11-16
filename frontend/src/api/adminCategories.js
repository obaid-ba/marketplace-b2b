import { http } from './http'

/**
 * Gestion des catégories et sous-catégories (SCRUM-32 / F06).
 */

/**
 * Récupère l'arborescence complète des catégories avec comptages d'utilisation.
 */
export async function fetchAdminCategories() {
  const { data } = await http.get('/admin/categories')
  return data
}

/**
 * Crée une nouvelle catégorie ou sous-catégorie.
 * @param {{ name: string, parent_id?: number | null, position?: number }} payload
 */
export async function createAdminCategory(payload) {
  const { data } = await http.post('/admin/categories', payload)
  return data
}

/**
 * Met à jour une catégorie (renommage, parent_id, position).
 * @param {number} id
 * @param {{ name?: string, parent_id?: number | null, position?: number }} payload
 */
export async function updateAdminCategory(id, payload) {
  const { data } = await http.put(`/admin/categories/${id}`, payload)
  return data
}

/**
 * Réordonne un ensemble de catégories ou sous-catégories.
 * @param {Array<{ id: number, position: number, parent_id?: number | null }>} items
 */
export async function reorderAdminCategories(items) {
  const { data } = await http.patch('/admin/categories/reorder', { items })
  return data
}

/**
 * Supprime une catégorie si elle n'est utilisée par aucun produit ni aucune demande.
 * @param {number} id
 */
export async function deleteAdminCategory(id) {
  const { data } = await http.delete(`/admin/categories/${id}`)
  return data
}
