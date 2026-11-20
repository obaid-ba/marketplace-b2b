import { http } from './http'

/**
 * Demandes reçues et devis du fournisseur (F13 / SCRUM-44 à SCRUM-46).
 */

export async function fetchSupplierTenders(params = {}) {
  const { data } = await http.get('/supplier/tenders', { params })
  return data
}

export async function fetchSupplierTender(id) {
  const { data } = await http.get(`/supplier/tenders/${id}`)
  return data
}

/**
 * Envoie ou met à jour le devis unique d'une demande.
 * @param {number} tenderId
 * @param {{ amount: number, delivery_days: number, conditions?: string, comment?: string }} payload
 * @param {boolean} update
 */
export async function submitTenderQuote(tenderId, payload, update = false) {
  const url = `/supplier/tenders/${tenderId}/quote`
  const { data } = update ? await http.put(url, payload) : await http.post(url, payload)
  return data
}

export async function fetchSupplierQuotes(params = {}) {
  const { data } = await http.get('/supplier/quotes', { params })
  return data
}
