import { http } from './http'

/**
 * Assistants IA (SCRUM-124, SCRUM-77, SCRUM-78 / F30).
 * Le texte renvoyé est toujours une suggestion modifiable.
 */
export async function generateTenderDraft(payload) {
  const { data } = await http.post('/ai/tender-draft', payload)
  return data
}

export async function generateProductText(payload) {
  const { data } = await http.post('/ai/product-text', payload)
  return data
}

export async function acceptAiSuggestion(id) {
  const { data } = await http.post(`/ai/interactions/${id}/accept`)
  return data
}
