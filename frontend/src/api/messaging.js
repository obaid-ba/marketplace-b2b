import { http } from './http'
import { saveBlob } from '@/utils/saveBlob'

/** Messagerie (SCRUM-59 à SCRUM-61 / F21, F22). */

export async function fetchConversations(params = {}) {
  const { data } = await http.get('/conversations', { params })
  return data
}

export async function fetchConversation(id) {
  const { data } = await http.get(`/conversations/${id}`)
  return data
}

/** @param {{ context_type: 'direct'|'demande'|'devis'|'commande', context_id?: number, supplier_id?: number }} payload */
export async function openConversation(payload) {
  const { data } = await http.post('/conversations', payload)
  return data
}

/** @param {{ before?: number, after?: number }} params */
export async function fetchMessages(conversationId, params = {}) {
  const { data } = await http.get(`/conversations/${conversationId}/messages`, { params })
  return data
}

export async function sendMessage(conversationId, { body, attachment }) {
  if (!attachment) {
    const { data } = await http.post(`/conversations/${conversationId}/messages`, { body })
    return data
  }

  const form = new FormData()
  if (body) form.append('body', body)
  form.append('attachment', attachment)
  // Un fichier de 10 Mo peut dépasser le délai habituel sur une connexion lente.
  const { data } = await http.post(`/conversations/${conversationId}/messages`, form, { timeout: 120000 })
  return data
}

export async function markConversationRead(conversationId) {
  const { data } = await http.post(`/conversations/${conversationId}/read`)
  return data.unread_total
}

export async function fetchUnreadMessages() {
  const { data } = await http.get('/conversations/unread-count')
  return data.count
}

/** Fichier privé : récupéré avec le jeton Bearer puis enregistré sous son nom d'origine. */
export async function downloadMessageAttachment(message) {
  const { data } = await http.get(`/conversations/${message.conversation_id}/messages/${message.id}/attachment`, {
    responseType: 'blob',
    timeout: 120000,
  })
  saveBlob(data, message.attachment.name)
}
