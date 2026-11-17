import { http } from './http'

/**
 * Gestion des catégories par l'administrateur (SCRUM-32).
 * L'arbre renvoyé : [{ id, name, parent_id, position, products_count, tenders_count, children: [...] }]
 */
export async function fetchAdminCategories() {
  const { data } = await http.get('/admin/categories')
  return data
}

/** payload : { name, parent_id (null = catégorie principale), position? } */
export async function createCategory(payload) {
  const { data } = await http.post('/admin/categories', payload)
  return data
}

export async function updateCategory(id, payload) {
  const { data } = await http.put(`/admin/categories/${id}`, payload)
  return data
}

/** move : { direction: 'up' | 'down' } ou { position: n } (glisser-déposer). */
export async function moveCategory(id, move) {
  const { data } = await http.patch(`/admin/categories/${id}/move`, move)
  return data
}

export async function deleteCategory(id) {
  const { data } = await http.delete(`/admin/categories/${id}`)
  return data
}
