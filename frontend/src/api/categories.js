import { http } from './http'

/**
 * Arborescence publique des catégories (SCRUM-32), triée par position.
 * products_count = produits visibles dans le catalogue (sous-catégories incluses pour une catégorie principale).
 */
export async function fetchCategories() {
  const { data } = await http.get('/categories')
  return data
}
