import { http } from './http'

/**
 * Chatbot d'assistance (SCRUM-85). Réponse : { interaction_id, answer, links: [{ label, path }], simulated }.
 * history : derniers échanges [{ from: 'user' | 'assistant', text }].
 */
export async function sendChatbotMessage({ conversationId, message, history = [], page = null }) {
  const { data } = await http.post(
    '/chatbot/messages',
    { conversation_id: conversationId, message, history, page },
    { timeout: 60000, skipAuthRedirect: true },
  )
  return data
}
