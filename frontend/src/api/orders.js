import { http } from './http'

/**
 * Récupère les commandes passées par l'acheteur connecté (SCRUM-58).
 */
export async function fetchBuyerOrders(status = null, page = 1) {
  const params = typeof status === 'object' && status !== null ? { ...status } : { page }
  if (typeof status === 'string' && status !== 'all' && status !== 'Toutes') {
    params.status = status
  }
  const { data } = await http.get('/buyer/orders', { params })
  return data
}

export async function fetchBuyerOrder(id) {
  const { data } = await http.get(`/buyer/orders/${id}`)
  return data
}

/**
 * Passe une commande directe d'un ou plusieurs produits d'un même fournisseur (SCRUM-51).
 */
export async function createBuyerOrder(payload) {
  const { data } = await http.post('/buyer/orders', payload)
  return data
}

/**
 * Récupère les commandes reçues par le fournisseur connecté (SCRUM-58).
 */
export async function fetchSupplierOrders(status = null, page = 1) {
  const params = { page }
  if (status && status !== 'all' && status !== 'Toutes') {
    params.status = status
  }
  const { data } = await http.get('/supplier/orders', { params })
  return data
}

/**
 * Récupère le détail d'une commande (SCRUM-58).
 */
export async function fetchOrderDetails(orderId) {
  const { data } = await http.get(`/orders/${orderId}`)
  return data.order
}

/**
 * Télécharge un document commercial lié à une commande (devis, facture).
 */
export async function fetchOrderDocumentBlob(orderId, documentId) {
  const { data } = await http.get(`/orders/${orderId}/documents/${documentId}/download`, {
    responseType: 'blob',
  })
  return data
}

/**
 * Fait avancer le statut d'une commande côté fournisseur : validée -> expédiée -> livrée (SCRUM-55).
 */
export async function advanceSupplierOrder(orderId) {
  const { data } = await http.post(`/supplier/orders/${orderId}/advance`)
  return data
}

/**
 * Confirme la réception d'une commande côté acheteur et la clôture (SCRUM-56, SCRUM-57).
 */
export async function confirmReceiptOrder(orderId) {
  const { data } = await http.post(`/buyer/orders/${orderId}/confirm-receipt`)
  return data
}

/**
 * Télécharge un document commercial PDF (devis, facture) (SCRUM-57).
 */
export async function fetchDocumentDownloadBlob(documentId) {
  const { data } = await http.get(`/documents/${documentId}/download`, {
    responseType: 'blob',
  })
  return data
}
