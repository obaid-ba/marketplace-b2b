const time = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })
const dayMonth = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
const dayMonthYear = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

/**
 * Date lisible et relative : « Aujourd'hui, 09:12 », « Hier, 17:40 », « 12 nov., 14:05 »
 * (l'année est ajoutée si ce n'est pas l'année en cours). Heure locale du navigateur.
 *
 * @param {string | Date | null} value  date ISO 8601 renvoyée par l'API
 * @param {Date} now  date de référence (paramètre pour les tests)
 * @returns {string | null}
 */
export function formatRelativeDate(value, now = new Date()) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null

  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000)
  const hour = time.format(date)

  if (days === 0) return `Aujourd’hui, ${hour}`
  if (days === 1) return `Hier, ${hour}`
  const day = (date.getFullYear() === now.getFullYear() ? dayMonth : dayMonthYear).format(date)
  return `${day}, ${hour}`
}
