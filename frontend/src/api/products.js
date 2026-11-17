import { http } from './http'

/**
 * Fiche produit publique (SCRUM-36) : accessible sans connexion, 404 si le produit n'est pas visible.
 * La consultation est comptée par l'API (une fois par visiteur et par tranche de 30 min).
 */
export async function fetchProduct(id) {
  const { data } = await http.get(`/products/${id}`, { skipAuthRedirect: true })
  return data
}
