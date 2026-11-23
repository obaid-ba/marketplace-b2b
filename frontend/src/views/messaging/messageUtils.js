export const MAX_ATTACHMENT_MB = 10
export const ATTACHMENT_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'zip']
export const ATTACHMENT_ACCEPT = ATTACHMENT_EXTENSIONS.map((extension) => `.${extension}`).join(',')

/** Contrôle avant l'envoi (l'API revérifie). Renvoie un message d'erreur ou null. */
export function attachmentError(file) {
  const extension = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : ''
  if (!ATTACHMENT_EXTENSIONS.includes(extension)) {
    return 'Formats acceptés : PDF, images (JPG, PNG, WebP), Word, Excel, CSV, TXT, ZIP.'
  }
  if (file.size > MAX_ATTACHMENT_MB * 1024 * 1024) {
    return `La pièce jointe ne doit pas dépasser ${MAX_ATTACHMENT_MB} Mo.`
  }
  return null
}

export function formatFileSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`
}

/** Ajoute des messages sans doublon (réponse à l'envoi et événement temps réel peuvent se croiser). */
export function mergeMessages(current, incoming) {
  const byId = new Map(current.map((message) => [message.id, message]))
  incoming.forEach((message) => byId.set(message.id, message))
  return [...byId.values()].sort((a, b) => a.id - b.id)
}

/** Dernier message affiché dans la liste des conversations. */
export function messagePreview(message) {
  if (!message) return ''
  const text = message.body || (message.attachment ? `📎 ${message.attachment.name}` : '')
  return message.is_mine ? `Vous : ${text}` : text
}

export function dayLabel(value, now = new Date()) {
  const date = new Date(value)
  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOf(now) - startOf(date)) / 86_400_000)
  if (days === 0) return "Aujourd'hui"
  if (days === 1) return 'Hier'
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export function timeLabel(value) {
  return new Date(value).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

/** Date courte de la liste : heure aujourd'hui, sinon jour. */
export function shortDate(value, now = new Date()) {
  if (!value) return ''
  const label = dayLabel(value, now)
  if (label === "Aujourd'hui") return timeLabel(value)
  if (label === 'Hier') return label
  return new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}
