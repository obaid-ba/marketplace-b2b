import { http } from './http'

/**
 * Centre de notifications et préférences (F15 / SCRUM-62, SCRUM-63).
 */

export async function fetchNotifications(params = {}) {
  const { data } = await http.get('/notifications', { params })
  return data
}

export async function fetchUnreadCount() {
  const { data } = await http.get('/notifications/unread-count')
  return data.count
}

export async function markNotificationRead(id) {
  const { data } = await http.post(`/notifications/${id}/read`)
  return data
}

export async function markAllNotificationsRead() {
  const { data } = await http.post('/notifications/read-all')
  return data
}

/** @returns {Promise<{ preferences: object[], whatsapp: object }>} */
export async function fetchNotificationPreferences() {
  const { data } = await http.get('/notifications/preferences')
  return data
}

/**
 * @param {Array<{ event_type: string, channel: 'site'|'email'|'whatsapp', enabled: boolean }>} preferences
 */
export async function updateNotificationPreferences(preferences) {
  const { data } = await http.put('/notifications/preferences', { preferences })
  return data
}

/** Consentement aux notifications WhatsApp (SCRUM-133). Renvoie { preferences, whatsapp }. */
export async function setWhatsAppConsent(enabled) {
  const { data } = await http.put('/notifications/whatsapp', { enabled })
  return data
}
