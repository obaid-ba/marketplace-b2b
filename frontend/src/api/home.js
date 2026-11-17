import { http } from './http'

/**
 * Page d'accueil (SCRUM-38) : { stats: { suppliers, products, regions }, categories: [8], featured_products: [4] }.
 * Mise en cache 10 minutes par l'API.
 */
export async function fetchHome() {
  const { data } = await http.get('/home')
  return data
}
