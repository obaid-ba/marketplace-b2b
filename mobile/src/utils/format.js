const number = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 })
const amount = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const formatNumber = (value) => number.format(Number(value) || 0)

export const formatAmount = (value) => `${amount.format(Number(value) || 0)} TND`

export function formatPrice(price, unit) {
  if (price === null || price === undefined) return 'Prix sur devis'
  return unit ? `${formatAmount(price)} / ${unit}` : formatAmount(price)
}

/** « 2026-11-27… » → « 27/11/2026 ». */
export function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('fr-FR')
}

// Intl.RelativeTimeFormat n'existe pas dans Hermes sur iOS : formatage relatif fait à la main.
const STEPS = [
  [31536000, 'an', 'ans'],
  [2592000, 'mois', 'mois'],
  [86400, 'jour', 'jours'],
  [3600, 'heure', 'heures'],
  [60, 'minute', 'minutes'],
]

/** « il y a 2 heures », « hier »… */
export function timeAgo(value) {
  const seconds = (new Date(value).getTime() - Date.now()) / 1000
  if (Number.isNaN(seconds)) return ''
  for (const [size, singular, pluralForm] of STEPS) {
    if (Math.abs(seconds) < size) continue
    const count = Math.round(seconds / size)
    if (size === 86400 && count === -1) return 'hier'
    if (size === 86400 && count === 1) return 'demain'
    const label = `${Math.abs(count)} ${Math.abs(count) > 1 ? pluralForm : singular}`
    return count < 0 ? `il y a ${label}` : `dans ${label}`
  }
  return 'à l’instant'
}

export const plural = (count, singular, pluralForm = `${singular}s`) => `${count} ${count > 1 ? pluralForm : singular}`

/** Liste paginée Laravel ({ data: [...] }) ou tableau simple. */
export const rows = (page) => (Array.isArray(page) ? page : page?.data ?? [])
