import { http } from './http'

/**
 * Récupère le détail d'un produit et d'autres produits du même fournisseur (SCRUM-51).
 */
export async function fetchProduct(productId) {
  const { data } = await http.get(`/products/${productId}`)
  return data
}

/**
 * Récupère les produits d'un fournisseur.
 */
export async function fetchSupplierProducts(supplierId) {
  const { data } = await http.get(`/suppliers/${supplierId}/products`)
  return data
}
